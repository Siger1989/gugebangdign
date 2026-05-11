function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getSampleFrames({ duration_frames = 24, keyframes = [], sample_step = 4 } = {}) {
  const duration = Math.max(1, Math.round(Number(duration_frames) || 24));
  const frames = new Set([1, duration]);
  const sorted = [...keyframes]
    .map((keyframe) => Math.max(1, Math.round(Number(keyframe.timeline_frame) || 1)))
    .sort((a, b) => a - b);
  sorted.forEach((frame, index) => {
    frames.add(frame);
    const next = sorted[index + 1];
    if (next && next > frame + 1) {
      frames.add(Math.round((frame + next) / 2));
    }
  });
  for (let frame = 1; frame <= duration; frame += Math.max(1, Math.round(sample_step))) {
    frames.add(frame);
  }
  return [...frames]
    .filter((frame) => frame >= 1 && frame <= duration)
    .sort((a, b) => a - b);
}

export class PoseSampler {
  sample({ duration_frames, keyframes = [], sample_pose_at_frame, sample_step = 4, rig_basis = null } = {}) {
    if (typeof sample_pose_at_frame !== "function") {
      throw new Error("PoseSampler requires sample_pose_at_frame(frame)");
    }
    const frames = getSampleFrames({ duration_frames, keyframes, sample_step });
    const samples = frames.map((frame, index) => ({
      sample_index: index,
      frame,
      ...clone(sample_pose_at_frame(frame)),
    }));
    return {
      schema: "pose_sample_set_v1",
      duration_frames: Math.max(1, Math.round(Number(duration_frames) || 24)),
      sample_frames: frames,
      rig_basis: clone(rig_basis),
      samples,
    };
  }
}
