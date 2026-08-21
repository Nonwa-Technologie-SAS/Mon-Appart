"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { ChevronDownIcon, ChevronUpIcon, ViewIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { groupPhotosByRoom } from "@/lib/visit-rooms"
import { cn } from "@/lib/utils"

export type VisitPhoto = {
  id: string
  url: string
  room?: string | null
  sortOrder?: number | null
}

type VirtualTourViewerProps = {
  photos: VisitPhoto[]
  panoramaUrl?: string | null
}

type AislePad = {
  x: number
  z: number
  yaw: number
}

const EYE_HEIGHT = 1.58
const MOVE_SPEED = 3.6
const LOOK_SPEED = 0.0045
const AISLE_WIDTH = 2.55
const AISLE_LENGTH = 9.2
const GONDOLA_DEPTH = 0.46
const GONDOLA_HEIGHT = 2.22
const AISLE_PITCH = AISLE_WIDTH + GONDOLA_DEPTH
const LOBBY = 2.2

const PanoramaViewer = dynamic(
  () =>
    import("@/components/site/panorama-viewer").then((m) => m.PanoramaViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center text-sm text-white/70">
        Chargement de la visite 360°…
      </div>
    ),
  }
)

function coverTexture(
  texture: THREE.Texture,
  planeWidth: number,
  planeHeight: number
) {
  const image = texture.image as HTMLImageElement | undefined
  if (!image?.width || !image.height) return
  const imageAspect = image.width / image.height
  const planeAspect = planeWidth / planeHeight
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  if (imageAspect > planeAspect) {
    texture.repeat.set(planeAspect / imageAspect, 1)
    texture.offset.set((1 - texture.repeat.x) / 2, 0)
  } else {
    texture.repeat.set(1, imageAspect / planeAspect)
    texture.offset.set(0, (1 - texture.repeat.y) / 2)
  }
}

function makeSignTexture(label: string) {
  const canvas = document.createElement("canvas")
  canvas.width = 1024
  canvas.height = 160
  const context = canvas.getContext("2d")
  if (!context) return null
  context.fillStyle = "#050508"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = "#ffc107"
  context.lineWidth = 8
  context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24)
  context.fillStyle = "#ffffff"
  context.font = "700 86px sans-serif"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.shadowColor = "#1565c0"
  context.shadowBlur = 18
  context.fillText(label.toUpperCase(), canvas.width / 2, canvas.height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function VirtualTourViewer({
  photos,
  panoramaUrl,
}: VirtualTourViewerProps) {
  const rooms = groupPhotosByRoom(photos)
  const [roomIndex, setRoomIndex] = useState(0)
  const hostRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const lookRef = useRef({ yaw: 0, pitch: 0 })
  const padsRef = useRef<AislePad[]>([])
  const boundsRef = useRef({
    minX: -3,
    maxX: 3,
    minZ: -20,
    maxZ: -0.4,
  })
  const moveRef = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
  })
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState<VisitPhoto | null>(null)
  const [showPanorama, setShowPanorama] = useState(false)

  const photoKey = photos
    .map((photo) => `${photo.id}:${photo.room ?? ""}:${photo.sortOrder ?? 0}`)
    .join("|")
  const hasPrevRoom = rooms.length > 1 && roomIndex > 0
  const hasNextRoom = rooms.length > 1 && roomIndex < rooms.length - 1

  function goToPad(index: number) {
    const pad = padsRef.current[index]
    const camera = cameraRef.current
    if (!pad || !camera) return
    camera.position.set(pad.x, EYE_HEIGHT, pad.z)
    lookRef.current.yaw = pad.yaw
    lookRef.current.pitch = 0
    camera.rotation.y = pad.yaw
    camera.rotation.x = 0
    setRoomIndex(index)
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const aisles = groupPhotosByRoom(photos)
    let disposed = false
    let frame = 0
    const textures: THREE.Texture[] = []
    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []
    const clickable: THREE.Object3D[] = []

    const aisleCount = Math.max(aisles.length, 1)
    const startX = -((aisleCount - 1) * AISLE_PITCH) / 2
    const aisleX = (index: number) => startX + index * AISLE_PITCH
    const storeLength = LOBBY + AISLE_LENGTH + 1.6
    const storeWidth = aisleCount * AISLE_PITCH + 3.4
    const height = 3.4
    const zCenter = -LOBBY - AISLE_LENGTH / 2
    boundsRef.current = {
      minX: -storeWidth / 2 + 0.55,
      maxX: storeWidth / 2 - 0.55,
      minZ: -storeLength + 0.8,
      maxZ: -0.4,
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x07070c)
    scene.fog = new THREE.Fog(0x07070c, 16, 38)

    const camera = new THREE.PerspectiveCamera(72, 1, 0.08, 80)
    camera.rotation.order = "YXZ"
    camera.position.set(aisleX(0), EYE_HEIGHT, -1.05)
    lookRef.current = { yaw: 0, pitch: 0 }
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    host.appendChild(renderer.domElement)
    renderer.domElement.style.display = "block"
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    renderer.domElement.style.touchAction = "none"
    renderer.domElement.style.cursor = "crosshair"

    function resize() {
      const node = hostRef.current
      if (!node) return
      const nextWidth = node.clientWidth || 1
      const nextHeight = node.clientHeight || 1
      camera.aspect = nextWidth / nextHeight
      camera.updateProjectionMatrix()
      renderer.setSize(nextWidth, nextHeight, false)
    }

    resize()

    scene.add(new THREE.AmbientLight(0xb8c4d8, 0.38))
    const sun = new THREE.DirectionalLight(0xfff3d6, 0.55)
    sun.position.set(2, 6, 1)
    scene.add(sun)

    function track(
      geometry: THREE.BufferGeometry,
      material: THREE.Material
    ) {
      geometries.push(geometry)
      materials.push(material)
    }

    function addMesh(
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      x: number,
      y: number,
      z: number
    ) {
      track(geometry, material)
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x, y, z)
      scene.add(mesh)
      return mesh
    }

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x17141e,
      roughness: 0.92,
      metalness: 0.04,
    })
    const floor = addMesh(
      new THREE.PlaneGeometry(storeWidth, storeLength),
      floorMat,
      0,
      0,
      -storeLength / 2
    )
    floor.rotation.x = -Math.PI / 2

    const ceiling = addMesh(
      new THREE.PlaneGeometry(storeWidth, storeLength),
      new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 1 }),
      0,
      height,
      -storeLength / 2
    )
    ceiling.rotation.x = Math.PI / 2

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x15151c,
      roughness: 0.95,
    })
    const leftWall = addMesh(
      new THREE.PlaneGeometry(storeLength, height),
      wallMat,
      -storeWidth / 2,
      height / 2,
      -storeLength / 2
    )
    leftWall.rotation.y = Math.PI / 2
    const rightWall = addMesh(
      new THREE.PlaneGeometry(storeLength, height),
      wallMat,
      storeWidth / 2,
      height / 2,
      -storeLength / 2
    )
    rightWall.rotation.y = -Math.PI / 2
    const backWall = addMesh(
      new THREE.PlaneGeometry(storeWidth, height),
      wallMat,
      0,
      height / 2,
      0
    )
    backWall.rotation.y = Math.PI
    addMesh(
      new THREE.PlaneGeometry(storeWidth, height),
      wallMat,
      0,
      height / 2,
      -storeLength
    )

    for (let aisleIndex = 0; aisleIndex < aisleCount; aisleIndex += 1) {
      for (const z of [zCenter + 2.4, zCenter - 1.6]) {
        const light = new THREE.PointLight(0xfff1cc, 0.95, 8, 2)
        light.position.set(aisleX(aisleIndex), height - 0.18, z)
        scene.add(light)
        addMesh(
          new THREE.BoxGeometry(1.55, 0.05, 0.16),
          new THREE.MeshStandardMaterial({
            color: 0xf5e6b8,
            emissive: 0xf5e6b8,
            emissiveIntensity: 0.7,
          }),
          aisleX(aisleIndex),
          height - 0.04,
          z
        )
      }
    }

    function addGondola(x: number, zCenter: number) {
      const bodyGeo = new THREE.BoxGeometry(
        GONDOLA_DEPTH,
        GONDOLA_HEIGHT,
        AISLE_LENGTH - 0.35
      )
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x101014,
        roughness: 0.7,
      })
      addMesh(bodyGeo, bodyMat, x, GONDOLA_HEIGHT / 2, zCenter)
      for (let shelf = 0; shelf < 3; shelf += 1) {
        addMesh(
          new THREE.BoxGeometry(GONDOLA_DEPTH + 0.08, 0.04, AISLE_LENGTH - 0.5),
          new THREE.MeshStandardMaterial({ color: 0x1d1d24, roughness: 0.55 }),
          x,
          0.55 + shelf * 0.62,
          zCenter
        )
      }
    }

    function addPad(index: number, x: number, z: number) {
      const pad: AislePad = { x, z, yaw: 0 }
      const padGeo = new THREE.PlaneGeometry(1.55, 1.05)
      const padMat = new THREE.MeshBasicMaterial({
        color: 0x7c4dff,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      })
      const padMesh = new THREE.Mesh(padGeo, padMat)
      padMesh.rotation.x = -Math.PI / 2
      padMesh.position.set(x, 0.025, z)
      padMesh.userData.kind = "pad"
      padMesh.userData.roomIndex = index
      padMesh.userData.pad = pad
      scene.add(padMesh)
      clickable.push(padMesh)
      track(padGeo, padMat)

      const edgeGeo = new THREE.EdgesGeometry(padGeo)
      const edgeMat = new THREE.LineBasicMaterial({ color: 0xc4b5fd })
      const edges = new THREE.LineSegments(edgeGeo, edgeMat)
      edges.rotation.x = -Math.PI / 2
      edges.position.set(x, 0.03, z)
      scene.add(edges)
      geometries.push(edgeGeo)
      materials.push(edgeMat)
      return pad
    }

    function addPoster(
      texture: THREE.Texture,
      photo: VisitPhoto,
      x: number,
      y: number,
      z: number,
      rotationY: number
    ) {
      const posterWidth = 0.5
      const posterHeight = 0.76
      coverTexture(texture, posterWidth, posterHeight)
      const group = new THREE.Group()

      const backingGeo = new THREE.BoxGeometry(
        posterWidth + 0.04,
        posterHeight + 0.04,
        0.03
      )
      const backingMat = new THREE.MeshStandardMaterial({
        color: 0x080808,
        roughness: 0.4,
      })
      const backing = new THREE.Mesh(backingGeo, backingMat)
      backing.position.z = -0.02
      group.add(backing)
      track(backingGeo, backingMat)

      const photoGeo = new THREE.PlaneGeometry(posterWidth, posterHeight)
      const photoMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.55,
      })
      const photoMesh = new THREE.Mesh(photoGeo, photoMat)
      photoMesh.userData.kind = "photo"
      photoMesh.userData.photo = photo
      group.add(photoMesh)
      track(photoGeo, photoMat)
      clickable.push(photoMesh)

      group.position.set(x, y, z)
      group.rotation.y = rotationY
      scene.add(group)
    }

    const pads: AislePad[] = []
    for (let gondola = 0; gondola <= aisleCount; gondola += 1) {
      addGondola(
        startX - AISLE_WIDTH / 2 - GONDOLA_DEPTH / 2 + gondola * AISLE_PITCH,
        zCenter
      )
    }

    const roomsToPlace = aisles.length > 0 ? aisles : [{ id: "empty", label: "Visite", photos: [] }]
    roomsToPlace.forEach((aisle, index) => {
      const x = aisleX(index)
      pads.push(addPad(index, x, -LOBBY - 0.7))
      addPad(index, x, zCenter)
      addPad(index, x, zCenter - 2.4)

      const signTexture = makeSignTexture(aisle.label)
      if (signTexture) {
        textures.push(signTexture)
        const signGeo = new THREE.PlaneGeometry(2.35, 0.36)
        const signMat = new THREE.MeshBasicMaterial({
          map: signTexture,
          transparent: true,
        })
        const sign = new THREE.Mesh(signGeo, signMat)
        sign.position.set(x, 2.68, -LOBBY - 0.15)
        scene.add(sign)
        track(signGeo, signMat)
      }
    })
    padsRef.current = pads
    setReady(true)

    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin("anonymous")

    const loadTexture = (url: string) =>
      new Promise<THREE.Texture | null>((resolve) => {
        loader.load(
          url,
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace
            textures.push(texture)
            resolve(texture)
          },
          undefined,
          () => resolve(null)
        )
      })

    void (async () => {
      const loadedAisles = await Promise.all(
        aisles.map(async (aisle) => {
          const loaded = await Promise.all(
            aisle.photos.map(async (photo) => {
              const texture = await loadTexture(photo.url)
              return texture ? { photo, texture } : null
            })
          )
          return {
            aisle,
            framed: loaded.filter(
              (item): item is { photo: VisitPhoto; texture: THREE.Texture } =>
                item !== null
            ),
          }
        })
      )
      if (disposed) return

      loadedAisles.forEach(({ framed }, aisleIndex) => {
        const x = aisleX(aisleIndex)
        const leftCount = Math.ceil(framed.length / 2)

        framed.forEach((item, photoIndex) => {
          const onLeft = photoIndex < leftCount
          const localIndex = onLeft ? photoIndex : photoIndex - leftCount
          const sideCount = onLeft ? leftCount : framed.length - leftCount
          const perRow = Math.max(1, Math.ceil(sideCount / 2))
          const row = localIndex < perRow ? 0 : 1
          const col = row === 0 ? localIndex : localIndex - perRow
          const posterZ = zCenter + 2.6 - col * 0.88
          const y = row === 0 ? 1.64 : 0.8
          addPoster(
            item.texture,
            item.photo,
            onLeft ? x - AISLE_WIDTH / 2 + 0.03 : x + AISLE_WIDTH / 2 - 0.03,
            y,
            posterZ,
            onLeft ? Math.PI / 2 : -Math.PI / 2
          )
        })
      })

      if (panoramaUrl) {
        const hotspotGeo = new THREE.SphereGeometry(0.2, 24, 16)
        const hotspotMat = new THREE.MeshStandardMaterial({
          color: 0xffc107,
          emissive: 0xffc107,
          emissiveIntensity: 0.45,
        })
        const hotspot = new THREE.Mesh(hotspotGeo, hotspotMat)
        hotspot.position.set(aisleX(0), 1.15, -storeLength + 1.4)
        hotspot.userData.kind = "panorama"
        scene.add(hotspot)
        clickable.push(hotspot)
        track(hotspotGeo, hotspotMat)
      }

      if (!disposed) setReady(true)
    })()

    const timer = new THREE.Timer()
    timer.connect(document)
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let dragging = false
    let moved = false
    let lastX = 0
    let lastY = 0

    function clampCamera() {
      const bounds = boundsRef.current
      camera.position.x = Math.min(
        bounds.maxX,
        Math.max(bounds.minX, camera.position.x)
      )
      camera.position.z = Math.min(
        bounds.maxZ,
        Math.max(bounds.minZ, camera.position.z)
      )
      camera.position.y = EYE_HEIGHT
    }

    function applyLook(dx: number, dy: number) {
      lookRef.current.yaw -= dx * LOOK_SPEED
      lookRef.current.pitch -= dy * LOOK_SPEED
      lookRef.current.pitch = Math.min(0.8, Math.max(-0.8, lookRef.current.pitch))
      camera.rotation.y = lookRef.current.yaw
      camera.rotation.x = lookRef.current.pitch
    }

    function onPointerDown(event: PointerEvent) {
      dragging = true
      moved = false
      lastX = event.clientX
      lastY = event.clientY
      renderer.domElement.setPointerCapture(event.pointerId)
    }

    function onPointerMove(event: PointerEvent) {
      if (dragging) {
        const dx = event.clientX - lastX
        const dy = event.clientY - lastY
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
        lastX = event.clientX
        lastY = event.clientY
        applyLook(dx, dy)
        return
      }

      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hover = raycaster.intersectObjects(clickable, false)[0]
      renderer.domElement.style.cursor = hover ? "pointer" : "crosshair"
    }

    function onPointerUp(event: PointerEvent) {
      dragging = false
      renderer.domElement.releasePointerCapture(event.pointerId)
      if (moved) return

      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(clickable, false)[0]
      if (!hit) return

      if (hit.object.userData.kind === "panorama") {
        setShowPanorama(true)
        return
      }
      if (hit.object.userData.kind === "pad") {
        const pad = hit.object.userData.pad as AislePad
        const nextIndex = hit.object.userData.roomIndex as number
        camera.position.set(pad.x, EYE_HEIGHT, pad.z)
        lookRef.current.yaw = pad.yaw
        lookRef.current.pitch = 0
        camera.rotation.y = pad.yaw
        camera.rotation.x = 0
        setRoomIndex(nextIndex)
        return
      }
      if (hit.object.userData.photo) {
        setSelected(hit.object.userData.photo as VisitPhoto)
      }
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault()
      const direction = new THREE.Vector3()
      camera.getWorldDirection(direction)
      direction.y = 0
      direction.normalize()
      camera.position.addScaledVector(
        direction,
        event.deltaY > 0 ? -0.55 : 0.55
      )
      clampCamera()
    }

    function setMove(event: KeyboardEvent, pressed: boolean) {
      if (
        event.key === "z" ||
        event.key === "Z" ||
        event.key === "w" ||
        event.key === "W" ||
        event.key === "ArrowUp"
      ) {
        moveRef.current.forward = pressed
      }
      if (event.key === "s" || event.key === "S" || event.key === "ArrowDown") {
        moveRef.current.back = pressed
      }
      if (
        event.key === "q" ||
        event.key === "Q" ||
        event.key === "a" ||
        event.key === "A" ||
        event.key === "ArrowLeft"
      ) {
        moveRef.current.left = pressed
      }
      if (
        event.key === "d" ||
        event.key === "D" ||
        event.key === "ArrowRight"
      ) {
        moveRef.current.right = pressed
      }
    }

    function tick(time: number) {
      timer.update(time)
      const delta = Math.min(timer.getDelta(), 0.05)
      const move = moveRef.current
      if (move.forward || move.back || move.left || move.right) {
        const forward = new THREE.Vector3()
        camera.getWorldDirection(forward)
        forward.y = 0
        forward.normalize()
        const right = new THREE.Vector3(-forward.z, 0, forward.x)
        const step = MOVE_SPEED * delta
        if (move.forward) camera.position.addScaledVector(forward, step)
        if (move.back) camera.position.addScaledVector(forward, -step)
        if (move.right) camera.position.addScaledVector(right, step)
        if (move.left) camera.position.addScaledVector(right, -step)
        clampCamera()
      }
      renderer.render(scene, camera)
      frame = requestAnimationFrame(tick)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(host)
    renderer.domElement.addEventListener("pointerdown", onPointerDown)
    renderer.domElement.addEventListener("pointermove", onPointerMove)
    renderer.domElement.addEventListener("pointerup", onPointerUp)
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false })
    const onKeyDown = (event: KeyboardEvent) => setMove(event, true)
    const onKeyUp = (event: KeyboardEvent) => setMove(event, false)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    frame = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      timer.dispose()
      observer.disconnect()
      renderer.domElement.removeEventListener("pointerdown", onPointerDown)
      renderer.domElement.removeEventListener("pointermove", onPointerMove)
      renderer.domElement.removeEventListener("pointerup", onPointerUp)
      renderer.domElement.removeEventListener("wheel", onWheel)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      cameraRef.current = null
      textures.forEach((texture) => texture.dispose())
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [photoKey, panoramaUrl, photos])

  function nudge(direction: 1 | -1) {
    const camera = cameraRef.current
    if (!camera) return
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    camera.position.addScaledVector(forward, direction * 0.95)
    const bounds = boundsRef.current
    camera.position.x = Math.min(
      bounds.maxX,
      Math.max(bounds.minX, camera.position.x)
    )
    camera.position.z = Math.min(
      bounds.maxZ,
      Math.max(bounds.minZ, camera.position.z)
    )
    camera.position.y = EYE_HEIGHT
  }

  return (
    <div className="relative size-full min-h-0 bg-[#07070c]">
      <div ref={hostRef} className="size-full min-h-0" />

      {ready ? null : (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#07070c] text-white">
          <p className="text-xs tracking-[0.2em] uppercase text-white/70">
            Mon Appart
          </p>
          <p className="mt-3 text-xl font-semibold">Ouverture de la visite…</p>
        </div>
      )}

      {ready ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-2 p-3">
          {rooms.length > 0 ? (
            <div className="pointer-events-auto flex max-w-full flex-wrap justify-center gap-1">
              {rooms.map((room, index) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => goToPad(index)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    index === roomIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-black/55 text-white hover:bg-black/75"
                  )}
                >
                  {room.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {ready ? (
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/75" />
      ) : null}

      {ready ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="rounded-full bg-black/55 px-3 py-1 text-xs text-white backdrop-blur-sm">
            Cliquez un rectangle au sol pour vous déplacer · cliquez une photo
          </p>
          <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
            {hasPrevRoom ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => goToPad(roomIndex - 1)}
              >
                Allée précédente
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => nudge(1)}
            >
              <ChevronUpIcon data-icon="inline-start" />
              Avancer
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => nudge(-1)}
            >
              <ChevronDownIcon data-icon="inline-start" />
              Reculer
            </Button>
            {hasNextRoom ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => goToPad(roomIndex + 1)}
              >
                Allée suivante
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-white">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-medium">Photo du logement</p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Fermer la photo"
                onClick={() => setSelected(null)}
              >
                <XIcon />
              </Button>
            </div>
            <div className="relative aspect-16/10 bg-muted">
              <Image
                src={selected.url}
                alt="Photo du logement"
                fill
                sizes="800px"
                quality={85}
                className="object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}

      {showPanorama && panoramaUrl ? (
        <div className="absolute inset-0 z-30 flex flex-col bg-black">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <p className="inline-flex items-center gap-2 text-sm font-medium">
              <ViewIcon className="size-4" />
              Visite 360°
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowPanorama(false)}
            >
              Retour à la visite
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <PanoramaViewer panoramaUrl={panoramaUrl} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
