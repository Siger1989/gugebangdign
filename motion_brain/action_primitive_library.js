export const ACTION_PRIMITIVES = {
  shift_weight: {
    id: "shift_weight",
    name: "重心转移",
    affects: ["COG_CTRL", "Pelvis_CTRL", "R_Foot_IK", "L_Foot_IK"],
    tags: ["body", "balance"],
  },
  lean_body: {
    id: "lean_body",
    name: "身体倾斜",
    affects: ["COG_CTRL", "Chest_CTRL", "Head_CTRL"],
    tags: ["body", "posture"],
  },
  lower_cog: {
    id: "lower_cog",
    name: "降低重心",
    affects: ["COG_CTRL", "Pelvis_CTRL", "R_Foot_IK", "L_Foot_IK"],
    tags: ["body", "height", "parameterized"],
  },
  raise_cog: {
    id: "raise_cog",
    name: "抬高重心",
    affects: ["COG_CTRL", "Pelvis_CTRL"],
    tags: ["body", "height", "parameterized"],
  },
  rotate_torso: {
    id: "rotate_torso",
    name: "躯干旋转",
    affects: ["Pelvis_CTRL", "Chest_CTRL"],
    tags: ["body", "twist"],
  },
  bend_knees: {
    id: "bend_knees",
    name: "弯曲膝盖",
    affects: ["COG_CTRL", "R_Foot_IK", "L_Foot_IK", "R_Knee_Pole", "L_Knee_Pole"],
    tags: ["leg", "height", "support"],
  },
  crouch_down: {
    id: "crouch_down",
    name: "下蹲",
    affects: ["COG_CTRL", "Pelvis_CTRL", "R_Foot_IK", "L_Foot_IK"],
    tags: ["body", "height"],
  },
  rise_up: {
    id: "rise_up",
    name: "起身",
    affects: ["COG_CTRL", "Pelvis_CTRL"],
    tags: ["body", "height"],
  },
  reach_hand: {
    id: "reach_hand",
    name: "伸手",
    affects: ["R_Hand_IK", "L_Hand_IK", "R_Elbow_Pole", "L_Elbow_Pole"],
    tags: ["hand", "ik"],
  },
  reach_effector: {
    id: "reach_effector",
    name: "参数化伸向目标",
    affects: ["R_Hand_IK", "L_Hand_IK", "R_Elbow_Pole", "L_Elbow_Pole", "Chest_CTRL"],
    tags: ["effector", "ik", "target"],
  },
  drive_effector: {
    id: "drive_effector",
    name: "驱动主执行部位",
    affects: ["R_Hand_IK", "L_Hand_IK", "R_Foot_IK", "L_Foot_IK", "Chest_CTRL"],
    tags: ["effector", "main_action", "parameterized"],
  },
  extend_limb: {
    id: "extend_limb",
    name: "伸展肢体",
    affects: ["R_Hand_IK", "L_Hand_IK", "R_Elbow_Pole", "L_Elbow_Pole"],
    tags: ["effector", "limb"],
  },
  retract_effector: {
    id: "retract_effector",
    name: "收回执行部位",
    affects: ["R_Hand_IK", "L_Hand_IK", "Chest_CTRL"],
    tags: ["effector", "recover"],
  },
  lock_contact: {
    id: "lock_contact",
    name: "接触锁定",
    affects: ["R_Hand_IK", "L_Hand_IK", "R_Foot_IK", "L_Foot_IK"],
    tags: ["contact", "lock"],
  },
  release_contact: {
    id: "release_contact",
    name: "释放接触",
    affects: ["R_Hand_IK", "L_Hand_IK", "R_Foot_IK", "L_Foot_IK"],
    tags: ["contact", "release"],
  },
  lock_hand: {
    id: "lock_hand",
    name: "手部锁定目标",
    affects: ["R_Hand_IK", "L_Hand_IK"],
    tags: ["hand", "contact", "lock"],
  },
  release_hand: {
    id: "release_hand",
    name: "手释放",
    affects: ["R_Hand_IK", "L_Hand_IK"],
    tags: ["hand", "contact", "release"],
  },
  plant_foot: {
    id: "plant_foot",
    name: "脚踩稳",
    affects: ["R_Foot_IK", "L_Foot_IK", "R_Knee_Pole", "L_Knee_Pole"],
    tags: ["foot", "contact"],
  },
  lock_foot: {
    id: "lock_foot",
    name: "脚锁定",
    affects: ["R_Foot_IK", "L_Foot_IK"],
    tags: ["foot", "contact", "lock"],
  },
  release_foot: {
    id: "release_foot",
    name: "脚释放",
    affects: ["R_Foot_IK", "L_Foot_IK"],
    tags: ["foot", "contact", "release"],
  },
  push_off: {
    id: "push_off",
    name: "蹬地",
    affects: ["COG_CTRL", "R_Foot_IK", "L_Foot_IK"],
    tags: ["foot", "force"],
  },
  push_target: {
    id: "push_target",
    name: "推目标",
    affects: ["COG_CTRL", "Chest_CTRL", "R_Hand_IK", "L_Hand_IK", "R_Foot_IK", "L_Foot_IK"],
    tags: ["interaction", "force", "contact"],
  },
  pull_target: {
    id: "pull_target",
    name: "拉目标",
    affects: ["COG_CTRL", "Chest_CTRL", "R_Hand_IK", "L_Hand_IK"],
    tags: ["interaction", "force", "contact"],
  },
  pull_back: {
    id: "pull_back",
    name: "后撤",
    affects: ["Root_CTRL", "COG_CTRL", "R_Foot_IK", "L_Foot_IK"],
    tags: ["body", "retreat"],
  },
  swing_arm: {
    id: "swing_arm",
    name: "摆臂 / 挥动",
    affects: ["R_Hand_IK", "L_Hand_IK", "Chest_CTRL"],
    tags: ["hand", "arc"],
  },
  brace_body: {
    id: "brace_body",
    name: "身体支撑",
    affects: ["COG_CTRL", "Chest_CTRL", "R_Foot_IK", "L_Foot_IK"],
    tags: ["body", "contact", "force"],
  },
  impact_body: {
    id: "impact_body",
    name: "身体撞击",
    affects: ["Root_CTRL", "COG_CTRL", "Chest_CTRL", "Head_CTRL"],
    tags: ["body", "impact"],
  },
  impact: {
    id: "impact",
    name: "冲击峰值",
    affects: ["Root_CTRL", "COG_CTRL", "Chest_CTRL", "R_Hand_IK", "L_Hand_IK"],
    tags: ["impact", "peak"],
  },
  recoil_body: {
    id: "recoil_body",
    name: "反冲",
    affects: ["Root_CTRL", "COG_CTRL", "Chest_CTRL", "Head_CTRL"],
    tags: ["body", "recoil"],
  },
  follow_through: {
    id: "follow_through",
    name: "随动",
    affects: ["COG_CTRL", "Chest_CTRL", "R_Hand_IK", "L_Hand_IK"],
    tags: ["body", "settle"],
  },
  recover_pose: {
    id: "recover_pose",
    name: "恢复姿势",
    affects: ["COG_CTRL", "Pelvis_CTRL", "Chest_CTRL", "Head_CTRL", "R_Hand_IK", "L_Hand_IK"],
    tags: ["body", "recover"],
  },
  settle_pose: {
    id: "settle_pose",
    name: "稳定落位",
    affects: ["COG_CTRL", "Pelvis_CTRL", "Chest_CTRL", "Head_CTRL", "R_Hand_IK", "L_Hand_IK", "R_Foot_IK", "L_Foot_IK"],
    tags: ["body", "settle", "contact"],
  },
  look_target: {
    id: "look_target",
    name: "看向目标",
    affects: ["Head_CTRL", "Chest_CTRL"],
    tags: ["head", "target"],
  },
};

export function getActionPrimitive(id) {
  return ACTION_PRIMITIVES[id] || null;
}

export function getActionPrimitives(ids = []) {
  return ids.map(getActionPrimitive).filter(Boolean);
}

export function listActionPrimitives() {
  return Object.values(ACTION_PRIMITIVES);
}
