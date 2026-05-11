import { createActionIntent, validateActionIntent } from "./action_intent.js";

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

const WORDS = {
  tired: ["\u75b2\u60eb", "\u75b2\u52b3", "tired"],
  panic: ["\u614c\u5f20", "\u60ca\u614c", "\u6050\u614c", "panic"],
  angry: ["\u6124\u6012", "\u7528\u529b", "\u731b\u70c8", "angry", "heavy"],
  natural: ["\u81ea\u7136", "\u8f7b\u677e", "natural", "relaxed"],
  forward: ["\u5411\u524d", "\u524d\u65b9", "forward"],
  backward: ["\u5411\u540e", "\u540e\u9000", "\u5411\u5f8c", "backward"],
  left: ["\u5411\u5de6", "left"],
  right: ["\u5411\u53f3", "right"],
  up: ["\u5411\u4e0a", "up"],
  down: ["\u5411\u4e0b", "down"],
  door: ["\u95e8", "door"],
  wall: ["\u5899", "wall"],
  box: ["\u7bb1", "box"],
  floor: ["\u5730\u4e0a", "\u5730\u9762", "\u5730\u677f", "floor", "ground"],
  weapon: ["\u6b66\u5668", "\u5251", "\u5200", "weapon", "sword"],
};

export class ActionIntentParser {
  parse(text = "") {
    const rawText = String(text || "").trim();
    const source = rawText.toLowerCase();
    const intent = createActionIntent({
      raw_text: rawText,
      style: hasAny(source, WORDS.natural) ? "natural" : "neutral",
    });

    this.applyMood(source, intent);
    this.applyDirection(source, intent);
    this.applyTargetAndProps(source, intent);
    this.applyActionType(source, intent);
    this.applyParserMetadata(source, intent);

    const validation = validateActionIntent(intent);
    return {
      intent,
      parser: {
        name: "keyword_rules_v2",
        parser_confidence: intent.parser_confidence,
        parsed_verbs: [...intent.parsed_verbs],
        parsed_body_parts: [...intent.parsed_body_parts],
        parsed_direction: intent.parsed_direction,
        parsed_target: intent.parsed_target,
        missing_slots: [...intent.missing_slots],
        uncertainty_flags: [...intent.uncertainty_flags],
      },
      validation,
    };
  }

  applyMood(source, intent) {
    if (hasAny(source, WORDS.panic)) {
      intent.emotion = "panic";
      intent.mood = "panic";
      intent.energy = "high";
      intent.speed = "fast";
    } else if (hasAny(source, WORDS.tired)) {
      intent.emotion = "tired";
      intent.mood = "tired";
      intent.energy = "low";
      intent.speed = "slow";
    } else if (hasAny(source, WORDS.angry)) {
      intent.emotion = "angry";
      intent.mood = "aggressive";
      intent.energy = "high";
      intent.force = "heavy";
    } else if (hasAny(source, WORDS.natural)) {
      intent.emotion = "neutral";
      intent.mood = "relaxed";
      intent.energy = "low";
      intent.force = "light";
    }
  }

  applyDirection(source, intent) {
    if (hasAny(source, WORDS.forward)) intent.direction = "forward";
    if (hasAny(source, WORDS.backward)) intent.direction = "backward";
    if (hasAny(source, WORDS.left)) intent.direction = "left";
    if (hasAny(source, WORDS.right)) intent.direction = "right";
    if (hasAny(source, WORDS.up)) intent.direction = "up";
    if (hasAny(source, WORDS.down)) intent.direction = "down";
  }

  applyTargetAndProps(source, intent) {
    if (hasAny(source, WORDS.door)) intent.target = "door";
    if (hasAny(source, WORDS.wall)) intent.target = "wall";
    if (hasAny(source, WORDS.box)) intent.target = "box";
    if (hasAny(source, WORDS.floor)) intent.target = intent.target || "floor";
    if (hasAny(source, WORDS.weapon)) intent.prop_usage = "weapon";
  }

  applyActionType(source, intent) {
    if (hasAny(source, ["\u53cc\u624b", "\u4e24\u624b", "both hands"])) {
      intent.main_body_part = "both_hands";
      intent.hand_usage = "both_hands";
    } else if (hasAny(source, ["\u53f3\u62f3", "\u53f3\u624b", "right fist", "right hand"])) {
      intent.main_body_part = hasAny(source, ["\u62f3", "fist", "punch"]) ? "right_fist" : "right_hand";
      intent.hand_usage = "right_hand";
    } else if (hasAny(source, ["\u5de6\u62f3", "\u5de6\u624b", "left fist", "left hand"])) {
      intent.main_body_part = hasAny(source, ["\u62f3", "fist", "punch"]) ? "left_fist" : "left_hand";
      intent.hand_usage = "left_hand";
    }

    if (hasAny(source, ["\u8eba\u4e0b", "\u8eba\u5012", "lie down", "lay down"])) {
      Object.assign(intent, {
        action_type: "posture_transition",
        subtype: "standing_to_ground",
        loopable: false,
        duration_frames: 36,
        body_posture: "lowering_to_floor",
        direction: "down",
        target: "floor",
        main_body_part: "full_body",
        hand_usage: "support",
        foot_usage: "ground_support",
        contact_requirements: ["ground_support"],
        validation_profile: "lie_down",
      });
      return;
    }

    if (hasAny(source, ["\u6325\u51fa\u53f3\u62f3", "\u53f3\u62f3", "\u51fa\u62f3", "\u62f3\u51fb", "punch", "strike"])) {
      const right = hasAny(source, ["\u53f3", "right"]);
      Object.assign(intent, {
        action_type: "attack",
        subtype: "forward_strike",
        loopable: false,
        duration_frames: 24,
        body_posture: "combat",
        direction: hasAny(source, WORDS.backward) ? "backward" : "forward",
        main_body_part: right ? "right_fist" : "dominant_fist",
        hand_usage: right ? "right_hand" : "dominant_hand",
        foot_usage: "braced",
        contact_requirements: ["impact"],
        validation_profile: "attack",
      });
      return;
    }

    if (hasAny(source, ["\u63a8\u5f00\u95e8", "\u63a8\u95e8", "\u63a8\u5f00", "\u63a8", "push"])) {
      Object.assign(intent, {
        action_type: "interaction",
        subtype: intent.target === "door" ? "push_door" : "push_object",
        target: intent.target || "target",
        loopable: false,
        duration_frames: intent.emotion === "tired" ? 34 : 28,
        direction: hasAny(source, WORDS.backward) ? "backward" : "forward",
        main_body_part: ["right_hand", "left_hand"].includes(intent.hand_usage) ? intent.main_body_part : "both_hands",
        hand_usage: ["right_hand", "left_hand"].includes(intent.hand_usage) ? intent.hand_usage : "both_hands",
        foot_usage: "braced",
        contact_requirements: ["hand_lock", "foot_brace"],
        validation_profile: "interaction",
      });
      return;
    }

    if (hasAny(source, ["\u6361\u8d77", "\u6361", "\u62fe\u53d6", "\u62ff\u8d77", "pick up", "grab"])) {
      Object.assign(intent, {
        action_type: "object_manipulation",
        subtype: intent.prop_usage === "weapon" ? "pick_up_weapon" : "pick_up",
        target: intent.prop_usage === "weapon" ? "weapon" : intent.target || "ground_item",
        loopable: false,
        duration_frames: 34,
        direction: "down",
        body_posture: "crouch_reach",
        main_body_part: ["right_hand", "left_hand"].includes(intent.hand_usage) ? intent.main_body_part : "both_hands",
        hand_usage: ["right_hand", "left_hand"].includes(intent.hand_usage) ? intent.hand_usage : "both_hands",
        contact_requirements: ["hand_lock", "ground_support"],
        validation_profile: "interaction",
      });
      return;
    }

    if (hasAny(source, ["\u540e\u9000", "\u649e\u5230\u5899", "\u649e\u5899", "\u649e\u5230", "\u649e", "backward", "wall"])) {
      Object.assign(intent, {
        action_type: hasAny(source, ["\u540e\u9000", "backward"]) ? "reaction" : "hit_reaction",
        subtype: intent.target === "wall" || hasAny(source, WORDS.wall) ? "wall_collision" : "backward_impact",
        target: intent.target || (hasAny(source, WORDS.wall) ? "wall" : null),
        loopable: false,
        duration_frames: 24,
        direction: "backward",
        foot_usage: "balance_recovery",
        contact_requirements: ["impact"],
        validation_profile: "hit_reaction",
      });
      return;
    }

    if (hasAny(source, ["\u666e\u901a\u8d70\u8def", "\u8d70\u8def", "\u884c\u8d70", "walk"])) {
      Object.assign(intent, {
        action_type: "locomotion",
        subtype: "walk",
        loopable: true,
        duration_frames: 24,
        hand_usage: "counter_swing",
        foot_usage: "alternating_contact",
        validation_profile: "walk",
      });
      return;
    }

    if (hasAny(source, ["\u5954\u8dd1", "\u8dd1\u6b65", "run"])) {
      Object.assign(intent, {
        action_type: "locomotion",
        subtype: "run",
        loopable: true,
        duration_frames: 18,
        body_posture: "forward_lean",
        hand_usage: "counter_swing",
        foot_usage: "alternating_contact_with_flight",
        validation_profile: "run",
      });
      return;
    }

    if (hasAny(source, ["\u8df3", "jump"])) {
      Object.assign(intent, {
        action_type: "locomotion",
        subtype: "jump_forward",
        loopable: false,
        duration_frames: 24,
        body_posture: "anticipation_crouch",
        foot_usage: "takeoff_landing",
        validation_profile: "jump",
      });
      return;
    }

    if (hasAny(source, ["\u53cc\u624b\u6b66\u5668\u6a2a\u6325", "\u6a2a\u6325", "\u653b\u51fb", "attack", "swing"])) {
      Object.assign(intent, {
        action_type: "attack",
        subtype: hasAny(source, ["\u53cc\u624b", "two"]) ? "two_handed_swing" : "attack",
        loopable: false,
        duration_frames: 20,
        body_posture: "combat",
        main_body_part: hasAny(source, ["\u53cc\u624b", "two"]) ? "both_hands" : intent.main_body_part,
        hand_usage: hasAny(source, ["\u53cc\u624b", "two"]) ? "both_hands" : intent.hand_usage,
        validation_profile: "attack",
      });
      return;
    }

    if (hasAny(source, ["\u4e3e\u624b\u6325\u624b", "\u6325\u624b", "\u4e3e\u624b", "wave", "raise hand"])) {
      Object.assign(intent, {
        action_type: "gesture",
        subtype: hasAny(source, ["\u6325\u624b", "wave"]) ? "wave_hand" : "raise_hand",
        loopable: false,
        duration_frames: 24,
        body_posture: "upright",
        main_body_part: hasAny(source, ["\u5de6", "left"]) ? "left_hand" : "right_hand",
        hand_usage: "raise_hand_wave",
        foot_usage: "both_planted",
        contact_requirements: [],
        validation_profile: "gesture",
      });
      return;
    }

    if (hasAny(source, ["\u7ad9\u7acb", "\u547c\u5438", "idle", "breath"])) {
      Object.assign(intent, {
        action_type: "idle",
        subtype: "breath",
        loopable: true,
        duration_frames: 24,
        body_posture: "relaxed_idle",
        hand_usage: "relaxed",
        foot_usage: "both_planted",
        validation_profile: "idle",
      });
      return;
    }

    if (hasAny(source, ["\u7ffb\u6eda", "\u95ea\u907f", "roll", "dodge"])) {
      Object.assign(intent, {
        action_type: "traversal",
        subtype: "dodge_roll",
        loopable: false,
        duration_frames: 24,
        body_posture: "low_roll",
        hand_usage: "guard",
        foot_usage: "release_then_recover",
        validation_profile: "dodge",
      });
      return;
    }

    Object.assign(intent, {
      action_type: "generic",
      subtype: "generic",
      loopable: false,
      duration_frames: 24,
      validation_profile: "generic",
    });
  }

  applyParserMetadata(source, intent) {
    const verbs = [];
    if (hasAny(source, ["\u8d70", "walk"])) verbs.push("walk");
    if (hasAny(source, ["\u8dd1", "run"])) verbs.push("run");
    if (hasAny(source, ["\u8df3", "jump"])) verbs.push("jump");
    if (hasAny(source, ["\u6325", "\u62f3", "attack", "punch", "strike"])) verbs.push("strike");
    if (hasAny(source, ["\u63a8", "push"])) verbs.push("push");
    if (hasAny(source, ["\u62c9", "pull"])) verbs.push("pull");
    if (hasAny(source, ["\u6361", "\u62fe\u53d6", "\u62ff\u8d77", "pick", "grab"])) verbs.push("grab");
    if (hasAny(source, ["\u8eba", "lie"])) verbs.push("lie_down");
    if (hasAny(source, ["\u649e", "hit", "impact"])) verbs.push("impact_body");
    if (hasAny(source, ["\u6325\u624b", "\u4e3e\u624b", "wave", "raise"])) verbs.push("wave");
    if (hasAny(source, ["\u52a8", "move"])) verbs.push("move");

    const bodyParts = [];
    if (hasAny(source, ["\u53f3\u62f3"])) bodyParts.push("right_fist");
    if (hasAny(source, ["\u5de6\u62f3"])) bodyParts.push("left_fist");
    if (hasAny(source, ["\u53f3\u624b"])) bodyParts.push("right_hand");
    if (hasAny(source, ["\u5de6\u624b"])) bodyParts.push("left_hand");
    if (hasAny(source, ["\u53cc\u624b", "\u4e24\u624b"])) bodyParts.push("both_hands");
    if (hasAny(source, ["\u5de6\u811a"])) bodyParts.push("left_foot");
    if (hasAny(source, ["\u53f3\u811a"])) bodyParts.push("right_foot");

    const direction = hasAny(source, WORDS.forward) ? "forward"
      : hasAny(source, WORDS.backward) ? "backward"
        : hasAny(source, WORDS.up) ? "up"
          : hasAny(source, WORDS.down) ? "down"
            : hasAny(source, WORDS.left) ? "left"
              : hasAny(source, WORDS.right) ? "right"
                : null;

    intent.parsed_verbs = unique(verbs);
    intent.parsed_body_parts = unique(bodyParts);
    intent.parsed_direction = direction || intent.direction || null;
    intent.parsed_target = intent.target || null;
    intent.missing_slots = [];
    intent.uncertainty_flags = [];

    let confidence = intent.action_type === "generic" ? 0.42 : 0.72;
    if (verbs.length > 0) confidence += 0.12;
    if (bodyParts.length > 0) confidence += 0.05;
    if (direction) confidence += 0.04;
    if (intent.target) confidence += 0.04;
    if (intent.action_type === "generic") intent.uncertainty_flags.push("generic_fallback");
    if (verbs.length > 0 && intent.action_type === "generic") intent.uncertainty_flags.push("verb_not_mapped");
    if (["interaction", "object_manipulation"].includes(intent.action_type) && !intent.target) {
      intent.missing_slots.push("target");
      intent.uncertainty_flags.push("target_missing");
      confidence -= 0.12;
    }
    if (bodyParts.length > 0 && !["right_hand", "left_hand", "both_hands", "dominant_hand", "raise_hand_wave"].includes(intent.hand_usage)) {
      intent.missing_slots.push("effector");
      intent.uncertainty_flags.push("body_part_not_bound_to_effector");
      confidence -= 0.10;
    }
    intent.parser_confidence = Math.max(0.05, Math.min(0.98, confidence));
  }
}
