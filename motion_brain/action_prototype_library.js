function c(offset = [0, 0, 0], rotation = [0, 0, 0], extra = {}) {
  return { offset, rotation, ...extra };
}

function phase(name, duration, primitives, controllers = {}, contact_state = {}, extra = {}) {
  return {
    phase_name: name,
    duration,
    primitives_used: primitives,
    root_motion: extra.root_motion || [0, 0, 0],
    cog_motion: controllers.COG_CTRL?.offset || [0, 0, 0],
    hip_motion: controllers.Pelvis_CTRL?.rotation || [0, 0, 0],
    chest_motion: controllers.Chest_CTRL?.rotation || [0, 0, 0],
    head_motion: controllers.Head_CTRL?.rotation || [0, 0, 0],
    hand_ik: {
      R: controllers.R_Hand_IK || null,
      L: controllers.L_Hand_IK || null,
    },
    foot_ik: {
      R: controllers.R_Foot_IK || null,
      L: controllers.L_Foot_IK || null,
    },
    pole_targets: {
      R_Knee_Pole: controllers.R_Knee_Pole || null,
      L_Knee_Pole: controllers.L_Knee_Pole || null,
      R_Elbow_Pole: controllers.R_Elbow_Pole || null,
      L_Elbow_Pole: controllers.L_Elbow_Pole || null,
    },
    fk_controls: extra.fk_controls || {},
    ik_fk_blend: extra.ik_fk_blend || {},
    contact_state,
    controllers,
  };
}

export const ACTION_PROTOTYPES = {
  Idle_Breath: {
    id: "Idle_Breath",
    action_type: "idle",
    subtype: "breath",
    loopable: true,
    duration_frames: 24,
    validation_profile: "idle",
    phases: [
      phase("base", 1, ["recover_pose"], {
        COG_CTRL: c([0, -0.015, 0]),
        Pelvis_CTRL: c([0, -0.005, 0], [0, 0.015, 0]),
        Chest_CTRL: c([0, 0, 0], [-0.03, -0.02, 0.02]),
        Head_CTRL: c([0, 0, 0], [0.02, 0.01, -0.01]),
        R_Hand_IK: c([-0.16, -0.34, 0.02]),
        L_Hand_IK: c([0.12, -0.36, -0.015]),
        R_Foot_IK: c([0.035, 0, 0], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([-0.035, 0, 0.015], [0, 0, 0], { locked: true }),
      }, { feet: { R: "locked", L: "locked" } }),
      phase("breathe_in", 7, ["recover_pose"], {
        COG_CTRL: c([0.006, 0, 0.006]),
        Chest_CTRL: c([0, 0, 0], [0.035, -0.025, 0.018]),
        Head_CTRL: c([0, 0, 0], [0.015, 0.016, -0.004]),
        R_Hand_IK: c([-0.145, -0.325, 0.03]),
        L_Hand_IK: c([0.135, -0.35, -0.01]),
        R_Foot_IK: c([0.035, 0, 0], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([-0.035, 0, 0.015], [0, 0, 0], { locked: true }),
      }, { feet: { R: "locked", L: "locked" } }),
      phase("breathe_out", 8, ["follow_through"], {
        COG_CTRL: c([-0.004, -0.025, -0.003]),
        Chest_CTRL: c([0, 0, 0], [-0.04, 0.02, -0.015]),
        Head_CTRL: c([0, 0, 0], [-0.01, -0.01, 0.008]),
        R_Hand_IK: c([-0.17, -0.35, 0.01]),
        L_Hand_IK: c([0.11, -0.365, -0.02]),
        R_Foot_IK: c([0.035, 0, 0], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([-0.035, 0, 0.015], [0, 0, 0], { locked: true }),
      }, { feet: { R: "locked", L: "locked" } }),
      phase("settle", 8, ["recover_pose"], {
        COG_CTRL: c([0, -0.015, 0]),
        Pelvis_CTRL: c([0, -0.005, 0], [0, 0.015, 0]),
        Chest_CTRL: c([0, 0, 0], [-0.03, -0.02, 0.02]),
        Head_CTRL: c([0, 0, 0], [0.02, 0.01, -0.01]),
        R_Hand_IK: c([-0.16, -0.34, 0.02]),
        L_Hand_IK: c([0.12, -0.36, -0.015]),
        R_Foot_IK: c([0.035, 0, 0], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([-0.035, 0, 0.015], [0, 0, 0], { locked: true }),
      }, { feet: { R: "locked", L: "locked" } }),
    ],
  },
  Walk_Basic: {
    id: "Walk_Basic",
    action_type: "locomotion",
    subtype: "walk",
    loopable: true,
    duration_frames: 24,
    validation_profile: "walk",
    phases: [
      phase("contact_r", 1, ["plant_foot", "lock_foot", "shift_weight", "swing_arm"], {
        COG_CTRL: c([0.035, -0.02, 0]),
        Pelvis_CTRL: c([0, 0, 0], [0, -0.08, 0.02]),
        Chest_CTRL: c([0, 0, 0], [0, 0.08, -0.018]),
        R_Foot_IK: c([0, 0, 0.16], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([0, 0.03, -0.14]),
        R_Hand_IK: c([-0.12, -0.20, -0.14]),
        L_Hand_IK: c([0.12, -0.20, 0.14]),
      }, { feet: { R: "locked", L: "free" } }),
      phase("passing", 6, ["release_foot", "shift_weight"], {
        COG_CTRL: c([0, 0.015, 0.04]),
        R_Foot_IK: c([0, 0, 0.06]),
        L_Foot_IK: c([0, 0.08, 0.02]),
        R_Hand_IK: c([-0.11, -0.19, -0.05]),
        L_Hand_IK: c([0.11, -0.20, 0.05]),
      }),
      phase("contact_l", 6, ["plant_foot", "lock_foot", "shift_weight", "swing_arm"], {
        COG_CTRL: c([-0.035, -0.02, 0]),
        Pelvis_CTRL: c([0, 0, 0], [0, 0.08, -0.02]),
        Chest_CTRL: c([0, 0, 0], [0, -0.08, 0.018]),
        R_Foot_IK: c([0, 0.03, -0.14]),
        L_Foot_IK: c([0, 0, 0.16], [0, 0, 0], { locked: true }),
        R_Hand_IK: c([-0.12, -0.20, 0.14]),
        L_Hand_IK: c([0.12, -0.20, -0.14]),
      }, { feet: { R: "free", L: "locked" } }),
      phase("passing_return", 6, ["release_foot", "shift_weight"], {
        COG_CTRL: c([0, 0.015, 0.04]),
        R_Foot_IK: c([0, 0.08, 0.02]),
        L_Foot_IK: c([0, 0, 0.06]),
        R_Hand_IK: c([-0.11, -0.19, 0.05]),
        L_Hand_IK: c([0.11, -0.20, -0.05]),
      }),
      phase("loop_contact_r", 5, ["plant_foot", "lock_foot", "shift_weight", "swing_arm"], {
        COG_CTRL: c([0.035, -0.02, 0]),
        Pelvis_CTRL: c([0, 0, 0], [0, -0.08, 0.02]),
        Chest_CTRL: c([0, 0, 0], [0, 0.08, -0.018]),
        R_Foot_IK: c([0, 0, 0.16], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([0, 0.03, -0.14]),
        R_Hand_IK: c([-0.12, -0.20, -0.14]),
        L_Hand_IK: c([0.12, -0.20, 0.14]),
      }, { feet: { R: "locked", L: "free" } }),
    ],
  },
  Run_Basic: {
    id: "Run_Basic",
    action_type: "locomotion",
    subtype: "run",
    loopable: true,
    duration_frames: 18,
    validation_profile: "run",
    phases: [
      phase("contact", 1, ["plant_foot", "lock_foot", "lean_body", "swing_arm"], {
        COG_CTRL: c([0.04, -0.06, 0.04]),
        Chest_CTRL: c([0, 0, 0], [0.18, 0.16, -0.04]),
        R_Foot_IK: c([0, 0, 0.20], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([0, 0.10, -0.22]),
        R_Hand_IK: c([-0.12, -0.12, -0.26]),
        L_Hand_IK: c([0.12, -0.12, 0.28]),
      }, { feet: { R: "locked", L: "free" } }),
      phase("push", 3, ["push_off", "release_foot"], {
        COG_CTRL: c([0.02, 0.04, 0.12]),
        Chest_CTRL: c([0, 0, 0], [0.22, 0.08, -0.03]),
        R_Foot_IK: c([0, 0.03, -0.04]),
        L_Foot_IK: c([0, 0.16, -0.04]),
      }),
      phase("flight", 3, ["release_foot", "swing_arm"], {
        COG_CTRL: c([0, 0.16, 0.16]),
        R_Foot_IK: c([0, 0.10, -0.12]),
        L_Foot_IK: c([0, 0.12, 0.12]),
        R_Hand_IK: c([-0.10, -0.10, 0.22]),
        L_Hand_IK: c([0.10, -0.10, -0.22]),
      }, { feet: { R: "free", L: "free" } }),
      phase("opposite_contact", 3, ["plant_foot", "lock_foot", "lean_body", "swing_arm"], {
        COG_CTRL: c([-0.04, -0.06, 0.04]),
        Chest_CTRL: c([0, 0, 0], [0.18, -0.16, 0.04]),
        R_Foot_IK: c([0, 0.10, -0.22]),
        L_Foot_IK: c([0, 0, 0.20], [0, 0, 0], { locked: true }),
        R_Hand_IK: c([-0.12, -0.12, 0.28]),
        L_Hand_IK: c([0.12, -0.12, -0.26]),
      }, { feet: { R: "free", L: "locked" } }),
      phase("opposite_push", 3, ["push_off", "release_foot"], {
        COG_CTRL: c([-0.02, 0.04, 0.12]),
        R_Foot_IK: c([0, 0.16, -0.04]),
        L_Foot_IK: c([0, 0.03, -0.04]),
      }),
      phase("flight_return", 5, ["release_foot", "swing_arm"], {
        COG_CTRL: c([0, 0.16, 0.16]),
        R_Foot_IK: c([0, 0.12, 0.12]),
        L_Foot_IK: c([0, 0.10, -0.12]),
      }, { feet: { R: "free", L: "free" } }),
      phase("loop_contact", 1, ["plant_foot", "lock_foot", "lean_body", "swing_arm"], {
        COG_CTRL: c([0.04, -0.06, 0.04]),
        Chest_CTRL: c([0, 0, 0], [0.18, 0.16, -0.04]),
        R_Foot_IK: c([0, 0, 0.20], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([0, 0.10, -0.22]),
        R_Hand_IK: c([-0.12, -0.12, -0.26]),
        L_Hand_IK: c([0.12, -0.12, 0.28]),
      }, { feet: { R: "locked", L: "free" } }),
    ],
  },
  Jump_Forward: {
    id: "Jump_Forward",
    action_type: "locomotion",
    subtype: "jump",
    loopable: false,
    duration_frames: 24,
    validation_profile: "jump",
    phases: [
      phase("anticipation", 1, ["crouch_down", "plant_foot", "lock_foot"], {
        COG_CTRL: c([0, -0.18, -0.02]),
        Chest_CTRL: c([0, 0, 0], [0.18, 0, 0]),
        R_Hand_IK: c([-0.12, -0.24, -0.10]),
        L_Hand_IK: c([0.12, -0.24, -0.10]),
        R_Foot_IK: c([0, 0, 0], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([0, 0, 0], [0, 0, 0], { locked: true }),
      }, { feet: { R: "locked", L: "locked" } }),
      phase("takeoff", 5, ["push_off", "release_foot", "rise_up"], {
        COG_CTRL: c([0, 0.08, 0.14]),
        Chest_CTRL: c([0, 0, 0], [-0.08, 0, 0]),
        R_Foot_IK: c([0, 0.04, -0.04]),
        L_Foot_IK: c([0, 0.04, -0.04]),
        R_Hand_IK: c([-0.12, -0.10, 0.10]),
        L_Hand_IK: c([0.12, -0.10, 0.10]),
      }),
      phase("flight", 6, ["release_foot", "follow_through"], {
        COG_CTRL: c([0, 0.28, 0.30]),
        R_Foot_IK: c([0, 0.16, 0.08]),
        L_Foot_IK: c([0, 0.14, -0.04]),
        R_Hand_IK: c([-0.10, -0.02, 0.18]),
        L_Hand_IK: c([0.10, -0.02, 0.16]),
      }, { feet: { R: "free", L: "free" } }),
      phase("landing", 6, ["plant_foot", "lock_foot", "crouch_down"], {
        COG_CTRL: c([0, -0.12, 0.42]),
        Chest_CTRL: c([0, 0, 0], [0.16, 0, 0]),
        R_Foot_IK: c([0, 0, 0.44], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([0, 0, 0.42], [0, 0, 0], { locked: true }),
      }, { feet: { R: "locked", L: "locked" } }),
      phase("recover", 6, ["recover_pose"], {
        COG_CTRL: c([0, 0, 0.46]),
        Chest_CTRL: c([0, 0, 0], [0, 0, 0]),
        R_Hand_IK: c([-0.14, -0.28, 0.42]),
        L_Hand_IK: c([0.14, -0.28, 0.42]),
        R_Foot_IK: c([0, 0, 0.46], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([0, 0, 0.44], [0, 0, 0], { locked: true }),
      }, { feet: { R: "locked", L: "locked" } }),
    ],
  },
  Attack_TwoHanded_Swing: {
    id: "Attack_TwoHanded_Swing",
    action_type: "combat",
    subtype: "attack",
    loopable: false,
    duration_frames: 20,
    validation_profile: "attack",
    phases: [
      phase("anticipation", 1, ["shift_weight", "rotate_torso", "swing_arm"], {
        COG_CTRL: c([-0.04, -0.04, -0.04]),
        Pelvis_CTRL: c([0, 0, 0], [0, -0.22, -0.02]),
        Chest_CTRL: c([0, 0, 0], [0.04, -0.42, 0.05]),
        R_Hand_IK: c([-0.08, -0.08, -0.32]),
        L_Hand_IK: c([0.08, -0.07, -0.28]),
        R_Foot_IK: c([0, 0, 0], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([0, 0, 0], [0, 0, 0], { locked: true }),
      }, { feet: { R: "locked", L: "locked" } }),
      phase("main_action", 5, ["shift_weight", "rotate_torso", "swing_arm"], {
        COG_CTRL: c([0.03, 0.02, 0.12]),
        Pelvis_CTRL: c([0, 0, 0], [0, 0.10, 0.01]),
        Chest_CTRL: c([0, 0, 0], [-0.02, 0.38, -0.04]),
        R_Hand_IK: c([-0.20, -0.02, 0.22]),
        L_Hand_IK: c([0.20, -0.015, 0.20]),
      }),
      phase("impact", 4, ["brace_body", "impact_body"], {
        COG_CTRL: c([0.05, -0.02, 0.22]),
        Chest_CTRL: c([0, 0, 0], [0.02, 0.46, -0.02]),
        R_Hand_IK: c([-0.24, -0.05, 0.32], [0, 0.25, 0], { locked: true }),
        L_Hand_IK: c([0.24, -0.04, 0.30], [0, 0.25, 0], { locked: true }),
      }, { hands: { R: "locked", L: "locked" } }),
      phase("follow_through", 5, ["follow_through"], {
        COG_CTRL: c([0.04, 0.0, 0.28]),
        Chest_CTRL: c([0, 0, 0], [-0.05, 0.22, -0.04]),
        R_Hand_IK: c([-0.18, -0.10, 0.42]),
        L_Hand_IK: c([0.18, -0.09, 0.40]),
      }),
      phase("recover", 5, ["recover_pose"], {
        COG_CTRL: c([0, -0.02, 0.24]),
        Chest_CTRL: c([0, 0, 0], [0, 0.06, 0]),
        R_Hand_IK: c([-0.14, -0.26, 0.16]),
        L_Hand_IK: c([0.14, -0.26, 0.14]),
      }),
    ],
  },
  Hit_Backward: {
    id: "Hit_Backward",
    action_type: "hit_reaction",
    subtype: "backward_impact",
    loopable: false,
    duration_frames: 20,
    validation_profile: "hit_reaction",
    phases: [
      phase("impact", 1, ["impact_body"], {
        COG_CTRL: c([0, -0.03, -0.08]),
        Chest_CTRL: c([0, 0, 0], [-0.22, 0, 0.05]),
        Head_CTRL: c([0, 0, 0], [-0.18, 0, 0]),
        R_Hand_IK: c([-0.22, -0.12, -0.10]),
        L_Hand_IK: c([0.22, -0.12, -0.10]),
      }),
      phase("recoil", 5, ["recoil_body", "pull_back"], {
        COG_CTRL: c([0, -0.08, -0.24]),
        Chest_CTRL: c([0, 0, 0], [-0.34, -0.05, 0.04]),
        Head_CTRL: c([0, 0, 0], [-0.22, -0.04, 0]),
        R_Hand_IK: c([-0.24, 0.02, -0.18]),
        L_Hand_IK: c([0.20, 0.02, -0.20]),
      }),
      phase("balance_loss", 7, ["pull_back", "brace_body"], {
        COG_CTRL: c([0.02, -0.14, -0.32]),
        Chest_CTRL: c([0, 0, 0], [-0.22, 0.10, -0.08]),
        R_Foot_IK: c([0, 0, -0.10], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([0, 0.04, -0.28]),
      }, { feet: { R: "locked", L: "free" } }),
      phase("recover", 7, ["recover_pose"], {
        COG_CTRL: c([0, -0.03, -0.18]),
        Chest_CTRL: c([0, 0, 0], [0.04, 0.02, 0]),
        Head_CTRL: c([0, 0, 0], [0, 0, 0]),
        R_Hand_IK: c([-0.14, -0.28, -0.10]),
        L_Hand_IK: c([0.14, -0.28, -0.10]),
      }),
    ],
  },
  Crouch_Basic: {
    id: "Crouch_Basic",
    action_type: "posture",
    subtype: "crouch",
    loopable: false,
    duration_frames: 16,
    validation_profile: "crouch",
    phases: [
      phase("prepare", 1, ["shift_weight"], { COG_CTRL: c([0, -0.04, 0]) }),
      phase("crouch_down", 6, ["crouch_down", "plant_foot", "lock_foot"], {
        COG_CTRL: c([0, -0.28, 0.02]),
        Chest_CTRL: c([0, 0, 0], [0.18, 0, 0]),
        R_Hand_IK: c([-0.10, -0.24, 0.04]),
        L_Hand_IK: c([0.10, -0.24, 0.04]),
        R_Foot_IK: c([0, 0, 0], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([0, 0, 0], [0, 0, 0], { locked: true }),
      }, { feet: { R: "locked", L: "locked" } }),
      phase("hold", 5, ["brace_body"], {
        COG_CTRL: c([0, -0.30, 0]),
        Chest_CTRL: c([0, 0, 0], [0.12, 0, 0]),
      }, { feet: { R: "locked", L: "locked" } }),
      phase("recover", 4, ["rise_up", "recover_pose"], {
        COG_CTRL: c([0, -0.04, 0]),
        Chest_CTRL: c([0, 0, 0], [0, 0, 0]),
      }),
    ],
  },
  Turn_90: {
    id: "Turn_90",
    action_type: "locomotion",
    subtype: "turn",
    loopable: false,
    duration_frames: 18,
    validation_profile: "turn",
    phases: [
      phase("prepare", 1, ["shift_weight", "plant_foot"], {
        COG_CTRL: c([0.02, -0.02, 0]),
        R_Foot_IK: c([0, 0, 0], [0, 0, 0], { locked: true }),
      }, { feet: { R: "locked", L: "free" } }),
      phase("turn", 8, ["rotate_torso", "release_foot"], {
        COG_CTRL: c([0.03, 0.02, 0.04]),
        Pelvis_CTRL: c([0, 0, 0], [0, 0.55, 0]),
        Chest_CTRL: c([0, 0, 0], [0, 0.78, 0]),
        L_Foot_IK: c([0.18, 0.06, 0.10]),
      }),
      phase("plant", 5, ["plant_foot", "lock_foot"], {
        COG_CTRL: c([-0.02, -0.02, 0.05]),
        L_Foot_IK: c([0.24, 0, 0.12], [0, 0, 0], { locked: true }),
      }, { feet: { R: "free", L: "locked" } }),
      phase("recover", 4, ["recover_pose"], {
        COG_CTRL: c([0, 0, 0.04]),
        Chest_CTRL: c([0, 0, 0], [0, 0.35, 0]),
      }),
    ],
  },
  Push_Object: {
    id: "Push_Object",
    action_type: "interaction",
    subtype: "push_object",
    loopable: false,
    duration_frames: 28,
    validation_profile: "interaction",
    phases: [
      phase("prepare", 1, ["look_target", "shift_weight"], {
        COG_CTRL: c([0, -0.04, -0.05]),
        Chest_CTRL: c([0, 0, 0], [0.10, 0, 0]),
        Head_CTRL: c([0, 0, 0], [0.06, 0, 0]),
      }),
      phase("reach", 5, ["reach_hand"], {
        COG_CTRL: c([0, -0.02, 0.04]),
        R_Hand_IK: c([-0.10, -0.06, 0.30]),
        L_Hand_IK: c([0.10, -0.06, 0.30]),
      }),
      phase("contact", 4, ["lock_hand", "brace_body", "plant_foot"], {
        COG_CTRL: c([0, -0.06, 0.08]),
        Chest_CTRL: c([0, 0, 0], [0.18, 0, 0]),
        R_Hand_IK: c([-0.10, -0.06, 0.34], [0, 0, 0], { locked: true }),
        L_Hand_IK: c([0.10, -0.06, 0.34], [0, 0, 0], { locked: true }),
        R_Foot_IK: c([0, 0, -0.06], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([0, 0, -0.02], [0, 0, 0], { locked: true }),
      }, { hands: { R: "locked", L: "locked" }, feet: { R: "locked", L: "locked" } }),
      phase("execute", 8, ["shift_weight", "lock_hand", "follow_through"], {
        COG_CTRL: c([0, -0.02, 0.26]),
        Chest_CTRL: c([0, 0, 0], [0.20, 0, 0]),
        R_Hand_IK: c([-0.10, -0.06, 0.34], [0, 0, 0], { locked: true }),
        L_Hand_IK: c([0.10, -0.06, 0.34], [0, 0, 0], { locked: true }),
      }, { hands: { R: "locked", L: "locked" } }),
      phase("release", 4, ["release_hand"], {
        R_Hand_IK: c([-0.12, -0.16, 0.20]),
        L_Hand_IK: c([0.12, -0.16, 0.20]),
      }),
      phase("recover", 6, ["recover_pose"], {
        COG_CTRL: c([0, -0.02, 0.12]),
        Chest_CTRL: c([0, 0, 0], [0, 0, 0]),
        R_Hand_IK: c([-0.14, -0.30, 0.06]),
        L_Hand_IK: c([0.14, -0.30, 0.06]),
      }),
    ],
  },
  Pick_Up_Object: {
    id: "Pick_Up_Object",
    action_type: "interaction",
    subtype: "pick_up",
    loopable: false,
    duration_frames: 30,
    validation_profile: "interaction",
    phases: [
      phase("prepare", 1, ["look_target", "shift_weight"], {
        Head_CTRL: c([0, 0, 0], [0.24, 0, 0]),
        COG_CTRL: c([0, -0.04, 0]),
      }),
      phase("crouch_down", 6, ["crouch_down", "plant_foot"], {
        COG_CTRL: c([0, -0.30, 0.02]),
        Chest_CTRL: c([0, 0, 0], [0.34, 0, 0]),
        R_Foot_IK: c([0, 0, 0], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([0, 0, 0.02], [0, 0, 0], { locked: true }),
      }, { feet: { R: "locked", L: "locked" } }),
      phase("reach", 6, ["reach_hand"], {
        COG_CTRL: c([0, -0.34, 0.06]),
        R_Hand_IK: c([-0.08, -0.48, 0.20]),
        L_Hand_IK: c([0.08, -0.44, 0.16]),
      }),
      phase("contact", 1, ["lock_hand"], {
        R_Hand_IK: c([-0.08, -0.50, 0.24], [0, 0, 0], { locked: true }),
        L_Hand_IK: c([0.08, -0.46, 0.22], [0, 0, 0], { locked: true }),
      }, { hands: { R: "locked", L: "locked" } }),
      phase("rise_up", 7, ["lock_hand", "rise_up"], {
        COG_CTRL: c([0, -0.08, 0.10]),
        Chest_CTRL: c([0, 0, 0], [0.12, 0, 0]),
        R_Hand_IK: c([-0.08, -0.22, 0.20]),
        L_Hand_IK: c([0.08, -0.20, 0.18]),
      }, { hands: { R: "held", L: "held" } }),
      phase("recover", 6, ["release_hand", "recover_pose"], {
        COG_CTRL: c([0, -0.02, 0.10]),
        Chest_CTRL: c([0, 0, 0], [0, 0, 0]),
        R_Hand_IK: c([-0.12, -0.24, 0.14]),
        L_Hand_IK: c([0.12, -0.24, 0.14]),
      }),
    ],
  },
  Wave_Hand: {
    id: "Wave_Hand",
    action_type: "gesture",
    subtype: "wave_hand",
    loopable: false,
    duration_frames: 24,
    validation_profile: "gesture",
    phases: [
      phase("prepare", 1, ["shift_weight", "recover_pose"], {
        COG_CTRL: c([0, -0.02, 0]),
        Chest_CTRL: c([0, 0, 0], [0.02, 0.03, 0]),
        R_Hand_IK: c([-0.10, -0.24, 0.04]),
        L_Hand_IK: c([0.12, -0.30, 0.02]),
        R_Foot_IK: c([0, 0, 0], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([0, 0, 0.01], [0, 0, 0], { locked: true }),
      }, { feet: { R: "locked", L: "locked" } }),
      phase("raise", 5, ["reach_hand", "shift_weight"], {
        COG_CTRL: c([-0.02, 0.02, 0.02]),
        Chest_CTRL: c([0, 0, 0], [-0.04, -0.08, 0.04]),
        Head_CTRL: c([0, 0, 0], [-0.02, -0.04, 0.02]),
        R_Hand_IK: c([-0.10, 0.40, 0.08], [0, 0, 0.15], { ik_weight: 1 }),
        L_Hand_IK: c([0.12, -0.30, 0.00], [0, 0, 0], { ik_weight: 0 }),
      }, { feet: { R: "locked", L: "locked" } }),
      phase("wave_out", 5, ["swing_arm"], {
        COG_CTRL: c([-0.015, 0.015, 0.02]),
        R_Hand_IK: c([-0.28, 0.42, 0.08], [0, 0, 0.35], { ik_weight: 1 }),
        L_Hand_IK: c([0.12, -0.31, 0.00], [0, 0, 0], { ik_weight: 0 }),
      }, { feet: { R: "locked", L: "locked" } }),
      phase("wave_in", 5, ["swing_arm", "follow_through"], {
        COG_CTRL: c([0.005, 0.01, 0.02]),
        R_Hand_IK: c([0.02, 0.43, 0.08], [0, 0, -0.25], { ik_weight: 1 }),
        L_Hand_IK: c([0.12, -0.31, 0.00], [0, 0, 0], { ik_weight: 0 }),
      }, { feet: { R: "locked", L: "locked" } }),
      phase("recover", 8, ["recover_pose"], {
        COG_CTRL: c([0, -0.02, 0]),
        Chest_CTRL: c([0, 0, 0], [0, 0, 0]),
        R_Hand_IK: c([-0.12, -0.26, 0.04]),
        L_Hand_IK: c([0.12, -0.31, 0.00], [0, 0, 0], { ik_weight: 0 }),
        R_Foot_IK: c([0, 0, 0], [0, 0, 0], { locked: true }),
        L_Foot_IK: c([0, 0, 0.01], [0, 0, 0], { locked: true }),
      }, { feet: { R: "locked", L: "locked" } }),
    ],
  },
};

export function listActionPrototypes() {
  return Object.values(ACTION_PROTOTYPES);
}

export function getActionPrototype(id) {
  return ACTION_PROTOTYPES[id] || null;
}

export function findPrototypeForIntent(intent) {
  const subtype = intent?.subtype;
  const profile = intent?.validation_profile;
  if (subtype === "breath" || profile === "idle") return ACTION_PROTOTYPES.Idle_Breath;
  if (subtype === "walk") return ACTION_PROTOTYPES.Walk_Basic;
  if (subtype === "run") return ACTION_PROTOTYPES.Run_Basic;
  if (subtype === "jump" || subtype === "jump_forward") return ACTION_PROTOTYPES.Jump_Forward;
  if (subtype === "two_handed_swing" || subtype === "attack") return ACTION_PROTOTYPES.Attack_TwoHanded_Swing;
  if (subtype === "backward_impact" || subtype === "wall_collision") return ACTION_PROTOTYPES.Hit_Backward;
  if (subtype === "crouch") return ACTION_PROTOTYPES.Crouch_Basic;
  if (subtype === "turn_90") return ACTION_PROTOTYPES.Turn_90;
  if (subtype === "push_door" || subtype === "push_object") return ACTION_PROTOTYPES.Push_Object;
  if (subtype === "pick_up" || subtype === "pick_up_weapon") return ACTION_PROTOTYPES.Pick_Up_Object;
  if (subtype === "wave_hand" || subtype === "raise_hand") return ACTION_PROTOTYPES.Wave_Hand;
  return null;
}
