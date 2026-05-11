const IMPORTANT_LOOP_CONTROLS = [
  "Root_CTRL",
  "COG_CTRL",
  "Pelvis_CTRL",
  "Chest_CTRL",
  "Head_CTRL",
  "R_Hand_IK",
  "L_Hand_IK",
  "R_Foot_IK",
  "L_Foot_IK",
];

function vector(value) {
  if (!Array.isArray(value) || value.length !== 3) {
    return [0, 0, 0];
  }
  return value.map((item) => Number(item) || 0);
}

function vectorDistance(a, b) {
  const av = vector(a);
  const bv = vector(b);
  return Math.hypot(av[0] - bv[0], av[1] - bv[1], av[2] - bv[2]);
}

function controllerVector(keyframe, controlId, field) {
  return vector(keyframe.controllers?.[controlId]?.[field]);
}

function maxRange(keyframes, controlId, field) {
  if (keyframes.length < 2) {
    return 0;
  }
  let max = 0;
  for (let i = 0; i < keyframes.length; i += 1) {
    for (let j = i + 1; j < keyframes.length; j += 1) {
      max = Math.max(max, vectorDistance(
        controllerVector(keyframes[i], controlId, field),
        controllerVector(keyframes[j], controlId, field),
      ));
    }
  }
  return max;
}

function phaseNames(motionPlan) {
  return new Set((motionPlan.phases || []).map((phase) => phase.phase_name));
}

function hasPhaseMatching(motionPlan, needle) {
  return (motionPlan.phases || []).some((phase) => String(phase.phase_name || "").includes(needle));
}

function hasContactLock(motionPlan, target) {
  return (motionPlan.phases || []).some((phase) => (
    phase.contact_state?.[target]?.R === "locked"
    || phase.contact_state?.[target]?.L === "locked"
    || phase.controllers?.[`R_${target === "hands" ? "Hand" : "Foot"}_IK`]?.locked
    || phase.controllers?.[`L_${target === "hands" ? "Hand" : "Foot"}_IK`]?.locked
  ));
}

function hasUpperBodyTask(intent = {}) {
  const actionType = String(intent.action_type || "");
  const subtype = String(intent.subtype || "").toLowerCase();
  const handUsage = String(intent.hand_usage || "").toLowerCase();
  const propUsage = String(intent.prop_usage || "").toLowerCase();
  return ["attack", "combat", "interaction", "object_manipulation", "gesture"].includes(actionType)
    || propUsage === "weapon"
    || ["push", "pull", "pick", "attack", "strike", "wave", "raise", "aim", "climb", "defend", "hold"].some((word) => subtype.includes(word))
    || ["both_hands", "dominant_hand", "raise", "wave", "weapon", "contact"].some((word) => handUsage.includes(word));
}

function getLockSlide(keyframes, target) {
  let maxSlide = 0;
  ["R", "L"].forEach((side) => {
    const controlId = `${side}_${target === "hands" ? "Hand" : "Foot"}_IK`;
    let anchor = null;
    keyframes.forEach((keyframe) => {
      const state = keyframe.contact_state?.[target]?.[side];
      const locked = state === "locked"
        || keyframe.controllers?.[controlId]?.locked
        || (target === "feet" && keyframe.foot_locks?.[side]);
      const offset = keyframe.controllers?.[controlId]?.offset;
      if (!locked || !offset) {
        anchor = null;
        return;
      }
      if (!anchor) {
        anchor = offset;
      } else {
        maxSlide = Math.max(maxSlide, vectorDistance(anchor, offset));
      }
    });
  });
  return maxSlide;
}

function getLoopDelta(keyframes) {
  const first = keyframes[0];
  const last = keyframes.at(-1);
  if (!first || !last) {
    return 0;
  }
  return IMPORTANT_LOOP_CONTROLS.reduce((max, controlId) => {
    const a = first.controllers?.[controlId];
    const b = last.controllers?.[controlId];
    if (!a && !b) {
      return max;
    }
    return Math.max(
      max,
      vectorDistance(a?.offset, b?.offset),
      vectorDistance(a?.rotation, b?.rotation),
    );
  }, 0);
}

export class ActionValidator {
  validate(intent, motionPlan, controllerKeyframes, poseFeatures = null) {
    const issues = [];
    const checks = {};
    const keyframes = controllerKeyframes || [];

    const addIssue = (code, message, severity = "error") => {
      issues.push({ code, message, severity });
    };
    const setCheck = (name, passed, message = "Passed") => {
      checks[name] = passed ? "Passed" : message;
    };

    const tposeSamples = keyframes.filter((keyframe) => {
      const r = keyframe.controllers?.R_Hand_IK?.offset;
      const l = keyframe.controllers?.L_Hand_IK?.offset;
      if (!r || !l) return false;
      return Math.abs(Number(r[0]) || 0) > 0.34
        && Math.abs(Number(l[0]) || 0) > 0.34
        && (Number(r[1]) || 0) > -0.16
        && (Number(l[1]) || 0) > -0.16;
    }).length;
    const tposeResidue = keyframes.length > 0 && tposeSamples / keyframes.length > 0.4;
    setCheck("no_tpose_residue", !tposeResidue, "T Pose residue");
    if (tposeResidue) {
      addIssue("no_tpose_residue", "Hand IK controls keep arms too wide and high for too long.");
    }

    const parserConfidence = Number(intent.parser_confidence ?? 1);
    const isGenericFallback = intent.action_type === "generic"
      || intent.subtype === "generic"
      || (intent.uncertainty_flags || []).includes("generic_fallback");
    setCheck("parser_confidence", parserConfidence >= 0.6 && !isGenericFallback, `Parser confidence ${parserConfidence.toFixed(2)}`);
    if (parserConfidence < 0.6) {
      addIssue("PARSER_UNCERTAIN", `Parser confidence is ${parserConfidence.toFixed(2)}; generated result must be reviewed.`);
    }
    if (isGenericFallback) {
      addIssue("GENERIC_FALLBACK_REVIEW", "Generic fallback is a draft, not a fully accepted action.");
    }

    const bodyRange = maxRange(keyframes, "COG_CTRL", "offset")
      + maxRange(keyframes, "Root_CTRL", "offset")
      + maxRange(keyframes, "Pelvis_CTRL", "rotation")
      + maxRange(keyframes, "Chest_CTRL", "rotation");
    const minBodyRange = intent.validation_profile === "idle" ? 0.012 : 0.045;
    const hasBodyMotion = bodyRange >= minBodyRange;
    setCheck("has_body_motion", hasBodyMotion, "Body controls are too static");
    if (!hasBodyMotion) {
      addIssue("has_body_motion", "Root / COG / Hip / Chest do not have enough driver motion.");
    }
    const visibleMainAction = bodyRange
      + maxRange(keyframes, "R_Hand_IK", "offset")
      + maxRange(keyframes, "L_Hand_IK", "offset")
      + maxRange(keyframes, "R_Foot_IK", "offset")
      + maxRange(keyframes, "L_Foot_IK", "offset");
    const minVisibleMainAction = intent.validation_profile === "idle" || intent.action_type === "idle" ? 0.015 : 0.08;
    setCheck("visible_main_action", visibleMainAction >= minVisibleMainAction, "No visible action");
    if (visibleMainAction < minVisibleMainAction) {
      addIssue("NO_VISIBLE_ACTION", "Generated controller curves do not contain a visible main action.");
    }

    const footSlide = getLockSlide(keyframes, "feet");
    setCheck("foot_sliding", footSlide <= 0.14, `Foot slide ${footSlide.toFixed(3)}`);
    if (footSlide > 0.14) {
      addIssue("foot_sliding", `Locked FootIK drifted ${footSlide.toFixed(3)} in controller space.`);
    }

    const handSlide = getLockSlide(keyframes, "hands");
    setCheck("contact_consistency", handSlide <= 0.16, `Hand lock drift ${handSlide.toFixed(3)}`);
    if (handSlide > 0.16) {
      addIssue("hand_contact_consistency", `Locked HandIK drifted ${handSlide.toFixed(3)} in controller space.`);
    }

    const hasInvalidPole = keyframes.some((keyframe) => ["R_Knee_Pole", "L_Knee_Pole", "R_Elbow_Pole", "L_Elbow_Pole"].some((id) => {
      const data = keyframe.controllers?.[id];
      return data && [...vector(data.offset), ...vector(data.rotation)].some((value) => !Number.isFinite(value));
    }));
    setCheck("knee_elbow_flip", !hasInvalidPole, "Pole target invalid");
    if (hasInvalidPole) {
      addIssue("knee_elbow_flip", "Pole target data contains invalid numeric values.");
    }

    if (intent.loopable || motionPlan.loopable) {
      const loopDelta = getLoopDelta(keyframes);
      setCheck("loop_continuity", loopDelta <= 0.10, `Loop delta ${loopDelta.toFixed(3)}`);
      if (loopDelta > 0.10) {
        addIssue("loop_continuity", `Loop start/end controller delta is ${loopDelta.toFixed(3)}.`);
      }
    } else {
      checks.loop_continuity = "Skipped";
    }

    const names = phaseNames(motionPlan);
    if (intent.validation_profile === "run") {
      const hasFlight = [...names].some((name) => name.includes("flight"));
      if (!hasFlight) addIssue("run_missing_flight", "Run must include a flight phase.");
    }
    if (intent.validation_profile === "jump") {
      if (!hasPhaseMatching(motionPlan, "anticipation")) addIssue("jump_missing_anticipation", "Jump must include anticipation.");
      if (!hasPhaseMatching(motionPlan, "flight")) addIssue("jump_missing_flight", "Jump must include flight.");
      if (!hasPhaseMatching(motionPlan, "landing")) addIssue("jump_missing_landing", "Jump must include landing.");
    }
    if (intent.validation_profile === "attack") {
      if (!hasPhaseMatching(motionPlan, "anticipation")) addIssue("attack_missing_anticipation", "Attack must include anticipation.");
      if (!hasPhaseMatching(motionPlan, "follow_through")) addIssue("attack_missing_follow_through", "Attack must include follow through.");
    }
    if (intent.validation_profile === "interaction") {
      if (!hasContactLock(motionPlan, "hands")) {
        addIssue("interaction_missing_contact_lock", "Interaction must lock HandIK during contact/execute.");
      }
    }

    if (poseFeatures?.summary) {
      const summary = poseFeatures.summary;
      checks.final_pose_sampled = "Passed";
      const shouldStrictlyRejectArmResidue = ["idle", "walk", "run"].includes(intent.validation_profile)
        || (!hasUpperBodyTask(intent) && ["attack"].includes(intent.validation_profile));
      if ((summary.arm?.t_pose_score || 0) > 0.55 && shouldStrictlyRejectArmResidue) {
        checks.no_tpose_residue = "Final pose T Pose residue";
        addIssue("TPOSE_RESIDUE", "Final solved pose still contains T/A pose arm residue.");
      }
      const bodyMotion = (summary.body?.root_motion_amount || 0)
        + (summary.body?.cog_vertical_motion || 0)
        + (summary.body?.cog_forward_motion || 0)
        + (summary.body?.hip_rotation || 0)
        + (summary.body?.chest_rotation || 0);
      const minFinalBodyMotion = intent.validation_profile === "idle" ? 0.02 : 0.08;
      if (bodyMotion < minFinalBodyMotion) {
        checks.has_body_motion = "Final pose body motion too small";
        addIssue("NO_BODY_MOTION", "Final solved pose has too little Root / COG / Hip / Chest motion.");
      }
      if ((summary.contact?.locked_target_world_drift || 0) > 0.22) {
        checks.contact_consistency = "Final lock drift";
        addIssue("CONTACT_LOCK_DRIFT", "Final solved locked targets drift too far.");
      }
      if (intent.validation_profile === "run" && !summary.legs?.flight_phase_exists) {
        checks.action_type_specific_rules = "Issues";
        addIssue("RUN_MISSING_FLIGHT", "Final solved run has no flight phase.");
      }
      if (intent.loopable || motionPlan.loopable) {
        const finalLoopDelta = summary.rhythm?.loop_continuity_score || 0;
        if (finalLoopDelta > 0.34) {
          checks.loop_continuity = `Final loop delta ${finalLoopDelta.toFixed(3)}`;
          addIssue("LOOP_CONTINUITY", `Final solved loop delta is ${finalLoopDelta.toFixed(3)}.`);
        }
      }
    } else {
      checks.final_pose_sampled = "Not run";
    }
    checks.action_type_specific_rules = issues.some((issue) => String(issue.code).toLowerCase().includes("missing")) ? "Issues" : "Passed";

    return {
      status: issues.length === 0 ? "Passed" : "Issues",
      checks,
      issues,
      checked_at: new Date().toISOString(),
    };
  }
}
