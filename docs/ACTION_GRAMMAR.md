# Action Grammar

`ActionGrammar` defines required phases, primitive requirements, and validation profiles. The grammar is a planning contract, not final pose data.

## Global Rule

All generated actions must become controller keyframes for Root / COG / Hip / Chest / Head / HandIK / FootIK / Pole / FK / IK-FK blend data where applicable. No parser or LLM may bypass Motion Brain and write skeleton poses directly.

## Supported Profiles

### Idle

- Required phases: `base`, `breathe_in`, `breathe_out`, `settle`
- Must avoid T Pose residue.
- Must enter relaxed idle base pose.
- Feet are slightly apart and planted.
- Knees are slightly bent.
- Shoulders and arms relax downward.
- Chest breathes subtly.
- Head and arms have delayed follow-through.
- Left and right sides are not perfectly mirrored.

### Walk

- Required phases: `contact_r`, `passing`, `contact_l`, `passing_return`
- Alternating foot contacts.
- No obvious flight frame.
- Small COG vertical motion.
- Upright body.
- Arms counter-swing against legs.
- Support foot locks during contact.
- Hip and chest counter-rotate subtly.

### Run

- Required phases: `contact`, `push`, `flight`, `opposite_contact`, `opposite_push`, `flight_return`
- Must include flight.
- Body leans forward.
- COG has clear vertical motion.
- COG lowers at contact, rises during push, peaks in flight.
- Arms counter-swing strongly.
- Hip and chest counter-rotate clearly.
- Support foot locks during contact.
- Run cannot be only a faster walk.

### Jump

- Required phases: `anticipation`, `takeoff`, `flight`, `landing`, `recover`
- Must include crouch anticipation.
- Must include takeoff, flight, landing compression, and recovery.
- It cannot be only Root/COG moving upward.

### Attack

- Required phases: `anticipation`, `main_action`, `impact`, `follow_through`, `recover`
- Must include anticipation and follow-through.
- Root / COG / Hip / Chest / Shoulder participate in force.
- It cannot be only hand movement.

### Hit Reaction

- Required phases: `impact`, `recoil`, `balance_loss`, `recover`
- Root and COG must show weight change.
- It cannot be only local bone shaking.

### Interaction

- Required phases: `prepare`, `reach`, `contact`, `execute`, `release`, `recover`
- Must identify a target when possible.
- Hand or body contact must lock during contact/execute.
- Contact point should not drift.
- Body weight participates; it cannot be only arm motion.

### Dodge

- Required phases: `anticipation`, `drop`, `roll`, `recover`
- Uses fallback primitive composition until higher quality prototypes are added.
