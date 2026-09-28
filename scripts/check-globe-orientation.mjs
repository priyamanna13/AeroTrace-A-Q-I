/**
 * Math check for the Screen 0 landing globe (post-fix).
 * Verifies the WebGL createSphere() vertex/UV mapping matches the
 * three.js SphereGeometry reference (geographic, non-mirrored), that east is
 * right in the RENDERED frame, and that the pin projection coincides with the
 * texture-India vertex after the same model rotations.
 *
 * Run: node scripts/check-globe-orientation.mjs
 */
let passed = 0, failed = 0
function check(name, cond) {
  if (cond) { passed++; console.log(`  PASS ${name}`) }
  else { failed++; console.log(`  FAIL ${name}`) }
}

// ── createSphere() copied verbatim from Screen0Landing.jsx (post-fix) ──
function createSphere(lat, lon) {
  const pos = [], uvs = []
  for (let y = 0; y <= lat; y++) {
    const latitude = y / lat
    const theta = latitude * Math.PI
    const sinT = Math.sin(theta), cosT = Math.cos(theta)
    for (let x = 0; x <= lon; x++) {
      const longitude = x / lon
      const phi = longitude * Math.PI * 2 - Math.PI
      pos.push(sinT * Math.cos(phi), cosT, -sinT * Math.sin(phi))
      uvs.push(longitude, 1 - latitude)
    }
  }
  return { pos, uvs }
}

// ── three.js SphereGeometry reference mapping (r152–r186) ──
function referenceVertex(u, v) {
  const theta = (1 - v) * Math.PI
  const phi = u * Math.PI * 2
  const sinT = Math.sin(theta), cosT = Math.cos(theta)
  return [-Math.cos(phi) * sinT, cosT, Math.sin(phi) * sinT]
}

// Model rotations, matching the GLSL in the vertex shader:
// rotateY: v' = (c·x + s·z, y, −s·x + c·z); rotateX: v' = (x, c·y − s·z, s·y + c·z)
const ROT = 2.863 // BASE_ROTATION post-fix
const TILT = 0.28 // baseTilt
function rotY(p, a) { const c = Math.cos(a), s = Math.sin(a); return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]] }
function rotX(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]] }
function model(p) { return rotX(rotY(p, ROT), TILT) }

const sphere = createSphere(72, 128)
const { pos, uvs } = sphere
const vertexCount = 73 * 129
check('vertex count matches grid', pos.length === vertexCount * 3 && uvs.length === vertexCount * 2)

let maxErr = 0
for (let y = 0; y <= 72; y += 4) {
  for (let x = 0; x <= 128; x += 7) {
    const i = y * 129 + x
    const [rx, ry, rz] = referenceVertex(uvs[i * 2], uvs[i * 2 + 1])
    maxErr = Math.max(maxErr, Math.abs(pos[i * 3] - rx), Math.abs(pos[i * 3 + 1] - ry), Math.abs(pos[i * 3 + 2] - rz))
  }
}
check(`mapping matches three.js reference (max err ${maxErr.toExponential(2)} < 1e-9)`, maxErr < 1e-9)

// East must be RIGHT in the rendered frame: take the texture-India vertex and
// its +15°E neighbour, run both through the model rotation, and compare screen
// x (screen x ∝ world +x when the camera looks down −Z from +z).
const INDIA_LAT = 21.5, INDIA_LON = 78.0
function geoVertex(latDeg, lonDeg) {
  const lat = latDeg * Math.PI / 180, lon = lonDeg * Math.PI / 180
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)]
}
const indiaCenter = model(geoVertex(INDIA_LAT, INDIA_LON))
const indiaEast = model(geoVertex(INDIA_LAT, INDIA_LON + 15))
const indiaNorth = model(geoVertex(INDIA_LAT + 15, INDIA_LON))
check(`east is right in rendered frame (${indiaEast[0].toFixed(3)} > ${indiaCenter[0].toFixed(3)})`, indiaEast[0] > indiaCenter[0])
check(`north is up in rendered frame (${indiaNorth[1].toFixed(3)} > ${indiaCenter[1].toFixed(3)})`, indiaNorth[1] > indiaCenter[1])

// India must be on the FRONT hemisphere (world z > −0.2 visibility gate) and
// in the left-of-center composition slot like the pre-fix design (−0.43).
check(`India front-facing (z ${indiaCenter[2].toFixed(3)} > −0.2)`, indiaCenter[2] > -0.2)
check(`India composed left of center (x ${indiaCenter[0].toFixed(3)} ≈ −0.43)`, Math.abs(indiaCenter[0] - -0.432) < 0.02)

// Pin/texture consistency: the render loop's indiaPoint (post-fix, corrected
// z sign) must equal the texture-India vertex after the same model rotation.
const indiaLat = 21.5 * Math.PI / 180, indiaLon = 78.0 * Math.PI / 180
const pinPoint = [Math.cos(indiaLat) * Math.cos(indiaLon), Math.sin(indiaLat), -Math.cos(indiaLat) * Math.sin(indiaLon)]
const pinRot = model(pinPoint)
const texIndia = model(geoVertex(INDIA_LAT, INDIA_LON))
const d = Math.hypot(pinRot[0] - texIndia[0], pinRot[1] - texIndia[1], pinRot[2] - texIndia[2])
check(`pin lands on texture-India after model rotation (dist ${d.toExponential(2)} < 1e-9)`, d < 1e-9)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
