import { createCriticIssue, createCriticReport } from "./critic_report.js";

function includesAny(value, words) {
  const text = String(value || "").toLowerCase();
  return words.some((word) => text.includes(word));
}

function allowsUpperBodyTask(intent = {}) {
  return intent.action_type === "interaction"
    || intent.action_type === "object_manipulation"
    || intent.action_type === "attack"
    || intent.action_type === "combat"
    || intent.action_type === "gesture"
    || intent.prop_usage === "weapon"
    || includesAny(intent.subtype, ["push", "pull", "pick", "attack", "wave", "raise", "aim", "climb", "defend", "hold"])
    || includesAny(intent.hand_usage, ["both_hands", "dominant_hand", "raise", "wave", "weapon", "contact"]);
}

function isOrdinaryLocomotionOrIdle(intent = {}) {
  return intent.action_type === "idle"
    || intent.validation_profile === "walk"
    || intent.validation_profile === "run"
    || ["walk", "run", "breath"].includes(intent.subtype);
}

function affectedFramesFor(samples = [], predicate) {
  return samples.filter(predicate).map((sample) => sample.frame);
}

function featureScale(summary = {}) {
  const scale = Number(summary.rig?.scale);
  return Number.isFinite(scale) && scale > 0 ? Math.max(scale, 0.35) : 1;
}

function scaled(base, summary = {}) {
  return base * featureScale(summary);
}

export class MotionCritic {
  review(intent, features) {
    const issues = [];
    const summary = features?.summary || {};
    const samples = features?.samples || [];
    const upperBodyTask = allowsUpperBodyTask(intent);
    const ordinary = isOrdinaryLocomotionOrIdle(intent);

    const maxRelaxedWristAboveChest = scaled(0.08, summary);
    if (ordinary && !upperBodyTask && summary.arm?.max_wrist_height_relative_to_chest > maxRelaxedWristAboveChest) {
      issues.push(createCriticIssue({
        code: "ARM_TOO_HIGH",
        severity: "blocker",
        message: "普通 locomotion / idle 中手腕长期高于胸口，疑似 T Pose/A Pose 或错误上肢任务残留。",
        affected_frames: affectedFramesFor(samples, (sample) => (
          sample.arms.R.wrist_height_relative_to_chest > maxRelaxedWristAboveChest
          || sample.arms.L.wrist_height_relative_to_chest > maxRelaxedWristAboveChest
        )),
        suggested_fix: "use_relaxed_locomotion_base_pose_and_fk_arm_swing",
        evidence: {
          max_wrist_height_relative_to_chest: summary.arm.max_wrist_height_relative_to_chest,
          max_allowed: maxRelaxedWristAboveChest,
          rig_scale: summary.rig?.scale,
        },
      }));
    }

    if (ordinary && !upperBodyTask && (summary.arm?.t_pose_score > 0.38 || summary.arm?.a_pose_score > 0.62)) {
      issues.push(createCriticIssue({
        code: "TPOSE_RESIDUE",
        severity: "blocker",
        message: "上臂长期接近水平展开，判定为 T Pose/A Pose 残留。",
        affected_frames: affectedFramesFor(samples, (sample) => (
          sample.arms.R.t_pose_score > 0.38
          || sample.arms.L.t_pose_score > 0.38
          || sample.arms.R.a_pose_score > 0.62
          || sample.arms.L.a_pose_score > 0.62
        )),
        suggested_fix: "regenerate_from_relaxed_base_pose",
        evidence: {
          t_pose_score: summary.arm.t_pose_score,
          a_pose_score: summary.arm.a_pose_score,
        },
      }));
    }

    if (ordinary && !upperBodyTask && summary.arm?.average_hand_ik_weight > 0.2) {
      issues.push(createCriticIssue({
        code: "HAND_IK_UNEXPECTED",
        severity: "blocker",
        message: "普通 walk/run/idle 不应使用 HandIK 驱动或锁定手臂，应改用 FK 自然摆臂。",
        affected_frames: samples.map((sample) => sample.frame),
        suggested_fix: "set_hand_ik_weight_to_0_and_use_fk_arm_swing",
        evidence: { average_hand_ik_weight: summary.arm.average_hand_ik_weight },
      }));
    }

    if (ordinary && !upperBodyTask && summary.arm?.side_swing_range > Math.max(0.10, summary.arm.forward_swing_range * 1.4)) {
      issues.push(createCriticIssue({
        code: "ARM_SWING_PLANE_WRONG",
        severity: "blocker",
        message: "摆臂方向偏左右展开，不是角色局部前后方向。",
        affected_frames: samples.map((sample) => sample.frame),
        suggested_fix: "regenerate_swing_arm_in_forward_axis",
        evidence: {
          forward_swing_range: summary.arm.forward_swing_range,
          side_swing_range: summary.arm.side_swing_range,
        },
      }));
    }

    const bodyMotion = (summary.body?.root_motion_amount || 0)
      + (summary.body?.cog_vertical_motion || 0)
      + (summary.body?.cog_forward_motion || 0)
      + (summary.body?.hip_rotation || 0)
      + (summary.body?.chest_rotation || 0);
    const minBodyMotion = scaled(intent.validation_profile === "idle" ? 0.02 : 0.08, summary);
    if (bodyMotion < minBodyMotion) {
      issues.push(createCriticIssue({
        code: "NO_BODY_MOTION",
        severity: "blocker",
        message: "Root / COG / Hip / Chest 基本不动，动作呈现身体木桩。",
        affected_frames: samples.map((sample) => sample.frame),
        suggested_fix: "add_cog_motion_and_hip_chest_counter_rotation",
        evidence: { body_motion_score: bodyMotion, min_required: minBodyMotion },
      }));
    }

    if (intent.validation_profile === "run" && !summary.legs?.flight_phase_exists) {
      issues.push(createCriticIssue({
        code: "RUN_MISSING_FLIGHT",
        severity: "blocker",
        message: "run 必须有双脚 free 的 flight phase，不能只是 walk 加速。",
        affected_frames: samples.map((sample) => sample.frame),
        suggested_fix: "insert_run_flight_phase",
      }));
    }

    if (intent.validation_profile === "jump") {
      if (!summary.rhythm?.anticipation_exists) {
        issues.push(createCriticIssue({
          code: "JUMP_MISSING_ANTICIPATION",
          severity: "blocker",
          message: "jump 缺少 anticipation / 下蹲蓄力。",
          suggested_fix: "insert_jump_anticipation_phase",
        }));
      }
      if (!summary.legs?.flight_phase_exists) {
        issues.push(createCriticIssue({
          code: "JUMP_MISSING_FLIGHT",
          severity: "blocker",
          message: "jump 缺少 flight / 腾空。",
          suggested_fix: "insert_jump_flight_phase",
        }));
      }
    }

    if (intent.validation_profile === "attack" && !summary.rhythm?.follow_through_exists) {
      issues.push(createCriticIssue({
        code: "ATTACK_MISSING_FOLLOW_THROUGH",
        severity: "blocker",
        message: "attack 缺少 follow_through。",
        suggested_fix: "insert_attack_follow_through_phase",
      }));
    }

    const maxInteractionHandDrift = scaled(0.18, summary);
    if (intent.validation_profile === "interaction" && summary.contact?.hand_contact_drift > maxInteractionHandDrift) {
      issues.push(createCriticIssue({
        code: "CONTACT_LOCK_MISSING",
        severity: "blocker",
        message: "interaction 接触阶段 HandIK 锁定目标漂移过大或未正确锁定。",
        suggested_fix: "lock_handik_during_contact_execute",
        evidence: { hand_contact_drift: summary.contact.hand_contact_drift, max_allowed: maxInteractionHandDrift },
      }));
    }

    if (ordinary && !upperBodyTask && summary.arm?.forward_swing_range < scaled(0.035, summary) && intent.validation_profile !== "idle") {
      issues.push(createCriticIssue({
        code: "ARM_SWING_TOO_SMALL",
        severity: "warning",
        message: "摆臂幅度较小，可以保存，但动作节奏会偏弱。",
        suggested_fix: "increase_fk_arm_swing_amplitude",
        evidence: { forward_swing_range: summary.arm.forward_swing_range },
      }));
    }

    return createCriticReport({ intent, issues, features });
  }
}
