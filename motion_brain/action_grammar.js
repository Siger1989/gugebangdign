export const ACTION_GRAMMAR = {
  idle: {
    required_phases: ["base", "breathe_in", "breathe_out", "settle"],
    required_primitives: ["recover_pose"],
    validation_profile: "idle",
    rules: [
      "no_tpose_residue",
      "subtle_asymmetry",
      "breathing_chest_motion",
      "loop_continuity",
    ],
  },
  walk: {
    required_phases: ["contact_r", "passing", "contact_l", "passing_return"],
    required_primitives: ["plant_foot", "lock_foot", "shift_weight", "swing_arm"],
    validation_profile: "walk",
    rules: ["alternating_foot_contact", "foot_sliding", "loop_continuity", "has_body_motion"],
  },
  run: {
    required_phases: ["contact", "push", "flight", "opposite_contact", "opposite_push", "flight_return"],
    required_primitives: ["plant_foot", "lock_foot", "release_foot", "push_off", "swing_arm", "lean_body"],
    validation_profile: "run",
    rules: ["must_have_flight", "foot_sliding", "has_body_motion", "loop_continuity"],
  },
  jump: {
    required_phases: ["anticipation", "takeoff", "flight", "landing", "recover"],
    required_primitives: ["crouch_down", "push_off", "release_foot", "plant_foot", "recover_pose"],
    validation_profile: "jump",
    rules: ["must_have_anticipation", "must_have_flight", "must_have_landing", "has_body_motion"],
  },
  attack: {
    required_phases: ["anticipation", "main_action", "impact", "follow_through", "recover"],
    required_primitives: ["shift_weight", "rotate_torso", "drive_effector", "extend_limb", "impact", "follow_through", "retract_effector", "recover_pose"],
    validation_profile: "attack",
    rules: ["must_have_anticipation", "must_have_impact", "must_have_follow_through", "has_body_motion"],
  },
  forward_strike: {
    required_phases: ["anticipation", "execute", "impact", "follow_through", "recover"],
    required_primitives: ["shift_weight", "rotate_torso", "drive_effector", "extend_limb", "impact", "follow_through", "retract_effector", "recover_pose"],
    validation_profile: "attack",
    rules: ["must_have_anticipation", "must_have_impact", "must_have_follow_through", "intent_effector_forward_motion"],
  },
  posture_transition: {
    required_phases: ["prepare", "lower_center", "support_contact", "body_lower", "settle_on_floor"],
    required_primitives: ["shift_weight", "lower_cog", "bend_knees", "reach_effector", "lock_contact", "lean_body", "settle_pose"],
    validation_profile: "lie_down",
    rules: ["must_have_ground_contact", "cog_descends", "controlled_body_lower"],
  },
  standing_to_ground: {
    required_phases: ["prepare", "lower_center", "support_contact", "body_lower", "settle_on_floor"],
    required_primitives: ["shift_weight", "lower_cog", "bend_knees", "reach_effector", "lock_contact", "lean_body", "settle_pose"],
    validation_profile: "lie_down",
    rules: ["must_have_ground_contact", "cog_descends", "controlled_body_lower"],
  },
  crouch: {
    required_phases: ["prepare", "crouch_down", "hold", "recover"],
    required_primitives: ["shift_weight", "lower_cog", "bend_knees", "plant_foot", "lock_foot", "brace_body", "recover_pose"],
    validation_profile: "crouch",
    rules: ["cog_descends", "foot_sliding", "has_body_motion", "recover_exists"],
  },
  hit_reaction: {
    required_phases: ["impact", "recoil", "balance_loss", "recover"],
    required_primitives: ["impact_body", "recoil_body", "pull_back", "recover_pose"],
    validation_profile: "hit_reaction",
    rules: ["must_have_impact", "must_have_recoil", "has_body_motion"],
  },
  reaction: {
    required_phases: ["backward_step", "impact", "recoil", "balance_loss", "recover"],
    required_primitives: ["shift_weight", "pull_back", "impact_body", "recoil_body", "recover_pose"],
    validation_profile: "hit_reaction",
    rules: ["must_have_impact", "must_have_recoil", "has_body_motion"],
  },
  interaction: {
    required_phases: ["prepare", "reach", "contact_lock", "force_apply", "follow_through", "release", "recover"],
    required_primitives: ["shift_weight", "reach_effector", "lock_contact", "lean_body", "push_target", "release_contact", "recover_pose"],
    validation_profile: "interaction",
    rules: ["must_have_contact_lock", "hand_contact_consistency", "has_body_motion"],
  },
  object_manipulation: {
    required_phases: ["prepare", "lower_or_reach", "contact_lock", "lift_or_pull", "secure", "recover"],
    required_primitives: ["shift_weight", "lower_cog", "reach_effector", "lock_contact", "raise_cog", "recover_pose"],
    validation_profile: "interaction",
    rules: ["must_have_contact_lock", "hand_contact_consistency", "has_body_motion"],
  },
  dodge: {
    required_phases: ["anticipation", "drop", "roll", "recover"],
    required_primitives: ["crouch_down", "shift_weight", "release_foot", "rotate_torso", "recover_pose"],
    validation_profile: "dodge",
    rules: ["must_have_anticipation", "has_body_motion"],
  },
  gesture: {
    required_phases: ["prepare", "raise", "wave_out", "wave_in", "recover"],
    required_primitives: ["shift_weight", "reach_hand", "swing_arm", "follow_through", "recover_pose"],
    validation_profile: "gesture",
    rules: ["allows_raised_hand", "has_body_motion", "recover_exists"],
  },
  generic: {
    required_phases: ["prepare", "main_action", "recover"],
    required_primitives: ["shift_weight", "lean_body", "recover_pose"],
    validation_profile: "generic",
    rules: ["has_body_motion", "no_tpose_residue"],
  },
};

export function getActionGrammar(intent) {
  const subtype = intent?.subtype;
  if (subtype && ACTION_GRAMMAR[subtype]) {
    return ACTION_GRAMMAR[subtype];
  }
  const verbFamily = intent?.verb_family;
  if (verbFamily && ACTION_GRAMMAR[verbFamily]) {
    return ACTION_GRAMMAR[verbFamily];
  }
  return ACTION_GRAMMAR[intent?.action_type] || ACTION_GRAMMAR.generic;
}
