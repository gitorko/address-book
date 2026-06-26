import { Billboard, Text } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { TOWER7_SIDEWAYS_OFFSET_Z, VISUAL_SCALE } from '../buildingConstants'

/**
 * Ground compass between towers. Arrow tip points **North (−Z)**.
 * **East +X** (toward Tower 7), **West −X** (toward Tower 6), **South +Z**, **North −Z**.
 */
export function CompassMap() {
  const midZ = TOWER7_SIDEWAYS_OFFSET_Z * 0.5
  /** Above the frosted pad; billboard quads tilt with the camera — keep clear of the disc in depth, not just Y. */
  const y = 0.085
  const baseY = 0.03

  const scale = 0.44 * VISUAL_SCALE
  const diskR = scale * 2.05
  const tipZ = -scale * 1.22
  const baseZ = scale * 0.38
  const halfW = scale * 0.4

  const { fillGeom, edgeGeom } = useMemo(() => {
    const tri = new Float32Array([
      0, y, tipZ,
      -halfW, y, baseZ,
      halfW, y, baseZ,
    ])
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(tri, 3))
    g.setIndex([0, 1, 2])
    g.computeVertexNormals()

    const line = new Float32Array([
      0, y, tipZ, -halfW, y, baseZ, -halfW, y, baseZ, halfW, y, baseZ, halfW, y, baseZ, 0, y, tipZ,
    ])
    const gl = new THREE.BufferGeometry()
    gl.setAttribute('position', new THREE.BufferAttribute(line, 3))
    return { fillGeom: g, edgeGeom: gl }
  }, [y, tipZ, baseZ, halfW])

  /** Separate materials for Troika fill colors; depth test on so labels occlude behind towers (pad is well below at `baseY`). */
  const labelMat = useMemo(
    () =>
      [0, 1, 2, 3].map(
        () =>
          new THREE.MeshBasicMaterial({
            depthTest: true,
            depthWrite: false,
            toneMapped: false,
            transparent: true,
          }),
      ),
    [],
  )

  const labelR = scale * 1.62
  const fs = 0.34 * VISUAL_SCALE
  const fsN = fs * 1.14

  const letter = (color: string, size: number, matIndex: number) => ({
    fontSize: size,
    fontWeight: 900,
    color,
    material: labelMat[matIndex],
    outlineWidth: '12%',
    outlineColor: '#fafaf8',
    strokeWidth: '4%',
    strokeColor: color,
    strokeOpacity: 1,
    anchorX: 'center' as const,
    anchorY: 'middle' as const,
    sdfGlyphSize: 256,
    glyphGeometryDetail: 2,
    renderOrder: 10,
  })

  return (
    <group position={[0, 0, midZ]}>
      {/* Frosted pad — separate Y slightly so rings don’t z-fight the base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseY, 0]} renderOrder={0}>
        <circleGeometry args={[diskR, 56]} />
        <meshBasicMaterial color="#f2f4f0" toneMapped={false} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseY + 0.004, 0]} renderOrder={1}>
        <ringGeometry args={[diskR * 0.92, diskR * 0.985, 56]} />
        <meshBasicMaterial color="#d4dad2" toneMapped={false} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseY + 0.008, 0]} renderOrder={2}>
        <circleGeometry args={[scale * 0.22, 24]} />
        <meshBasicMaterial color="#dfe6df" toneMapped={false} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>

      {/* North arrow (−Z); Y is well above pad so no need to disable depth test (avoids drawing over towers). */}
      <mesh geometry={fillGeom} renderOrder={4}>
        <meshBasicMaterial color="#2c4c72" side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <lineSegments geometry={edgeGeom} renderOrder={5}>
        <lineBasicMaterial color="#87a3be" toneMapped={false} />
      </lineSegments>

      {/* Billboard so letters stay readable from orbit (flat ground text is edge-on from the side) */}
      {/* North −Z (tip direction) */}
      <Billboard position={[0, y, tipZ - fsN * 0.45]} follow>
        <Text {...letter('#1e3a5f', fsN, 0)}>N</Text>
      </Billboard>
      {/* South +Z */}
      <Billboard position={[0, y, labelR]} follow>
        <Text {...letter('#5a6570', fs, 1)}>S</Text>
      </Billboard>
      {/* East +X (Tower 7) */}
      <Billboard position={[labelR, y, 0]} follow>
        <Text {...letter('#5a6570', fs, 2)}>E</Text>
      </Billboard>
      {/* West −X (Tower 6) */}
      <Billboard position={[-labelR, y, 0]} follow>
        <Text {...letter('#5a6570', fs, 3)}>W</Text>
      </Billboard>
    </group>
  )
}
