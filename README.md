# Bodymoji (React Native · Expo)

A realistic, headless 3D body avatar builder. Every body comes from an anatomical human model (MakeHuman, CC0) that is reshaped with morph targets, posed with a skeleton and smoothed with subdivision.
There are 97 body options, plus outfits and colours.

## Run it

```bash
cd bodymoji
npm install
npx expo start          # press i / a, or scan the QR code with Expo Go
npx expo start --web    # browser preview
```

The app only uses modules that ship in Expo Go (`expo-gl`, `expo-haptics`), so you don't need a custom dev build.

## What you can customise

| Category | Options |
|---|---|
| Body type (male) | Skinny, Slim, Average, Athletic, Muscular, Bodybuilder, Dad bod, Chubby, Overweight, Obese |
| Body type (female) | Petite, Slim, Average, Athletic, Fit & toned, Curvy, Hourglass, Pear, Apple, Plus size |
| Belly & abs | Flat, Little abs, 4-pack, 6-pack, 8-pack, Fat over abs, Soft belly, Pot belly, Beer belly, Overhang (fat over fat) |
| Chest (male) | Flat, Defined, Broad pecs, Bulky, Soft chest |
| Bust (female) | Small, Medium, Full, Large |
| Shoulders | Narrow, Average, Broad, Boulder |
| Arms | Thin, Toned, Athletic, Muscular, Huge, Soft |
| Waist | Tiny, Slim, Average, Thick, Wide |
| Hips | Narrow, Average, Wide, Very wide |
| Glutes | Flat, Average, Round, Athletic, Full |
| Thighs | Skinny, Slender, Toned, Athletic, Muscular, Thick, Heavy |
| Calves | Slim, Average, Defined, Muscular, Thick |
| Leg shape | Straight, Bow-legged (O), Knock-kneed (X) |
| Leg length | Short, Balanced, Long |
| Height | Short, Below avg, Average, Tall, Very tall |
| Posture | Relaxed, Upright, Chest out, Slouched |
| Pose | Standing, A-pose, Hands on hips, Flex |
| Feet | Barefoot, Ankle socks, Crew socks |
| Outfit | Gym shorts, Tank & shorts, Tee & shorts, Compression, Sports bra & shorts/leggings, Tank & leggings, Tee & joggers |
| Colours | 10 skin tones, plus 12 colours each for top, bottoms and socks |

Picking a body type sets every detail category to **Match body**. You can then override any category, for example an obese body with "Fat over abs", or a skinny body with a pot belly.

## How it works

```
tools/build_human.py   packs the MakeHuman base mesh + morph targets + skeleton weights
                       (head removed, neck capped) into src/data/humanData.js (~2.6 MB)
src/
  core/catalog.js      options → { macro (gender, muscle, weight, cup), morph targets, pose }
  human/
    humanData.js       decodes the packed data once
    model.js           morph → pose (skeleton skinning, 2-bone arm IK) → Catmull-Clark subdivision
    clothing.js        tight athletic wear painted as vertex colours (sports bra, tank, tee, shorts, leggings…)
    finish.js          fabric smoothing, cavity shading (soft occlusion in creases)
    bodymoji.js        config → finished mesh (adds sculpted abs for 4/6/8-pack)
  three/scene.js       studio lighting, skin + fabric materials, auto camera framing
  components/          <BodymojiView> (expo-gl) and the <Customizer> UI
```

* **Realism:** the anatomy comes from MakeHuman's base mesh (~9k vertices without the head, ~37k after subdivision). Gender, muscle and weight blend between MakeHuman's artist-made reference bodies. Detail targets cover belly, chest, bust, shoulders, waist, hips, glutes, thighs, calves, leg shape and leg length.
* **Speed:** a full rebuild takes about 25 ms on a desktop browser and an estimated 0.2–0.3 s on a phone. A small "Updating…" pill shows while the body rebuilds.
* **Regenerating the data:** to regenerate `src/data/humanData.js` (for example to add more morph targets), sparse-clone the MakeHuman repo and run `python3 tools/build_human.py <makehuman>/makehuman/data`. The script's header has the exact commands.
* **Licence:** the MakeHuman assets used here (base mesh, targets, skeleton) were released as CC0.

## Using the avatar elsewhere

```js
import BodymojiView from './src/components/BodymojiView';
<BodymojiView config={savedConfig} style={{ height: 300 }} />
```

The `config` is plain JSON (option ids and hex colours), so you can store it on your backend. `normalizeConfig()` fills in defaults for missing or unknown values.
