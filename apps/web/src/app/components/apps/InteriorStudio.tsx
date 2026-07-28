import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Camera, Check, Copy, Download, LampFloor, Loader2, Sofa, Table2, Trees } from "lucide-react";
import { sendChatMessage } from "../../api-client/chat";
import { useAuth } from "../../auth";
import { useLanguage } from "../../i18n";

type CameraInfo = {
  x: number;
  y: number;
  z: number;
  tx: number;
  tz: number;
};

type RoomApi = {
  capture: () => string;
  setFurniture: (name: string, visible: boolean) => void;
  setLens: (lens: number) => void;
  setLight: (value: string) => void;
  setPreset: (position: [number, number, number]) => void;
  setStyle: (value: string) => void;
};

type Furniture = {
  sofa: boolean;
  table: boolean;
  lamp: boolean;
  plant: boolean;
};

const cameraPresets = [
  { id: "front", label: "Фронт", position: [0, 3.2, 9] as [number, number, number] },
  { id: "corner", label: "3/4", position: [7.2, 4.2, 7.4] as [number, number, number] },
  { id: "low", label: "Снизу", position: [6.4, 1.65, 7.6] as [number, number, number] },
  { id: "top", label: "Сверху", position: [0.2, 10.5, 0.3] as [number, number, number] },
];

const roomLabels: Record<string, string> = {
  living: "гостиной",
  bedroom: "спальни",
  office: "кабинета",
  kitchen: "кухни",
};

const styleLabels: Record<string, string> = {
  warm: "теплый минимализм",
  nordic: "скандинавский",
  modern: "современный",
  japandi: "джапанди",
};

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  color: number,
  name?: string,
  roughness = 0.72,
) {
  const geometry = new THREE.BoxGeometry(...size);
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function buildRoom(scene: THREE.Scene) {
  const room = new THREE.Group();
  room.name = "room";
  scene.add(room);

  const shellMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8d1c4,
    roughness: 0.86,
    side: THREE.DoubleSide,
  });
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x655b50,
    roughness: 0.9,
  });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.14, 8), floorMaterial);
  floor.position.y = -0.07;
  floor.receiveShadow = true;
  room.add(floor);

  const back = new THREE.Mesh(new THREE.BoxGeometry(10, 5.2, 0.14), shellMaterial);
  back.position.set(0, 2.6, -4);
  back.receiveShadow = true;
  room.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(0.14, 5.2, 8), shellMaterial);
  left.position.set(-5, 2.6, 0);
  left.receiveShadow = true;
  room.add(left);

  const right = left.clone();
  right.position.x = 5;
  room.add(right);

  const windowFrame = new THREE.Group();
  windowFrame.position.set(2.25, 3, -3.9);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 1.75),
    new THREE.MeshPhysicalMaterial({
      color: 0x9fc8cb,
      transparent: true,
      opacity: 0.38,
      roughness: 0.15,
      transmission: 0.25,
    }),
  );
  windowFrame.add(glass);
  addBox(windowFrame, [2.9, 0.08, 0.08], [0, 0.92, 0.04], 0xe8e1d5);
  addBox(windowFrame, [2.9, 0.08, 0.08], [0, -0.92, 0.04], 0xe8e1d5);
  addBox(windowFrame, [0.08, 1.9, 0.08], [-1.45, 0, 0.04], 0xe8e1d5);
  addBox(windowFrame, [0.08, 1.9, 0.08], [1.45, 0, 0.04], 0xe8e1d5);
  addBox(windowFrame, [0.06, 1.75, 0.08], [0, 0, 0.04], 0xe8e1d5);
  room.add(windowFrame);

  const rug = new THREE.Mesh(
    new THREE.CylinderGeometry(2.65, 2.65, 0.045, 64),
    new THREE.MeshStandardMaterial({ color: 0xb8a98f, roughness: 1 }),
  );
  rug.scale.z = 0.68;
  rug.position.set(0.2, 0.035, 0.25);
  rug.receiveShadow = true;
  room.add(rug);

  const sofa = new THREE.Group();
  sofa.name = "sofa";
  sofa.position.set(-0.45, 0, -2.15);
  addBox(sofa, [4.15, 0.52, 1.25], [0, 0.5, 0], 0xb98a68);
  addBox(sofa, [4.15, 1.15, 0.42], [0, 1.15, -0.52], 0xa9785b);
  addBox(sofa, [0.38, 0.86, 1.42], [-2.05, 0.78, 0], 0xa9785b);
  addBox(sofa, [0.38, 0.86, 1.42], [2.05, 0.78, 0], 0xa9785b);
  addBox(sofa, [1.72, 0.28, 1.02], [-0.92, 0.86, 0.08], 0xd1aa87);
  addBox(sofa, [1.72, 0.28, 1.02], [0.92, 0.86, 0.08], 0xd1aa87);
  room.add(sofa);

  const table = new THREE.Group();
  table.name = "table";
  table.position.set(0.1, 0, 0.35);
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 0.16, 48),
    new THREE.MeshStandardMaterial({ color: 0x3b3733, roughness: 0.45 }),
  );
  top.position.y = 0.63;
  top.castShadow = true;
  table.add(top);
  addBox(table, [0.13, 0.62, 0.13], [-0.72, 0.31, -0.42], 0x242321, undefined, 0.35);
  addBox(table, [0.13, 0.62, 0.13], [0.72, 0.31, -0.42], 0x242321, undefined, 0.35);
  addBox(table, [0.13, 0.62, 0.13], [-0.72, 0.31, 0.42], 0x242321, undefined, 0.35);
  addBox(table, [0.13, 0.62, 0.13], [0.72, 0.31, 0.42], 0x242321, undefined, 0.35);
  room.add(table);

  const lamp = new THREE.Group();
  lamp.name = "lamp";
  lamp.position.set(3.55, 0, -2.4);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.06, 2.35, 18),
    new THREE.MeshStandardMaterial({ color: 0x34312e, metalness: 0.42, roughness: 0.35 }),
  );
  pole.position.y = 1.25;
  lamp.add(pole);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.62, 0.72, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xe2c795, side: THREE.DoubleSide, roughness: 0.82 }),
  );
  shade.position.y = 2.55;
  lamp.add(shade);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.5, 0.1, 32),
    new THREE.MeshStandardMaterial({ color: 0x34312e, metalness: 0.4, roughness: 0.38 }),
  );
  base.position.y = 0.05;
  lamp.add(base);
  room.add(lamp);

  const plant = new THREE.Group();
  plant.name = "plant";
  plant.position.set(-3.75, 0, -2.65);
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.5, 0.72, 24),
    new THREE.MeshStandardMaterial({ color: 0x9b5e42, roughness: 0.9 }),
  );
  pot.position.y = 0.36;
  plant.add(pot);
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x54705d, roughness: 0.88 });
  for (let i = 0; i < 7; i += 1) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 12), leafMaterial);
    const angle = (i / 7) * Math.PI * 2;
    leaf.scale.set(0.65, 1.45, 0.42);
    leaf.rotation.z = Math.sin(angle) * 0.7;
    leaf.position.set(Math.cos(angle) * 0.32, 0.95 + (i % 3) * 0.24, Math.sin(angle) * 0.25);
    leaf.castShadow = true;
    plant.add(leaf);
  }
  room.add(plant);

  const art = new THREE.Group();
  art.position.set(-2.15, 2.95, -3.9);
  addBox(art, [2.2, 1.45, 0.08], [0, 0, 0], 0x2b3130);
  addBox(art, [1.9, 1.15, 0.09], [0, 0, 0.04], 0xc77d61);
  room.add(art);

  return room;
}

function MiniMap({ camera }: { camera: CameraInfo }) {
  const x = Math.max(6, Math.min(94, ((camera.x + 8) / 16) * 100));
  const y = Math.max(6, Math.min(94, ((camera.z + 8) / 16) * 100));
  const tx = Math.max(12, Math.min(88, ((camera.tx + 5) / 10) * 100));
  const ty = Math.max(12, Math.min(88, ((camera.tz + 4) / 8) * 100));
  const angle = Math.atan2(camera.tz - camera.z, camera.tx - camera.x) * (180 / Math.PI);
  const cameraStyle = { "--cam-x": `${x}%`, "--cam-y": `${y}%`, "--cam-angle": `${angle}deg` } as CSSProperties;
  const targetStyle = { "--target-x": `${tx}%`, "--target-y": `${ty}%` } as CSSProperties;

  return (
    <div className="interior-map" aria-label="Положение камеры">
      <span className="interior-map__wall interior-map__wall--back" />
      <span className="interior-map__wall interior-map__wall--left" />
      <span className="interior-map__wall interior-map__wall--right" />
      <span className="interior-map__sofa" />
      <span className="interior-map__target" style={targetStyle} />
      <span className="interior-map__camera" style={cameraStyle}>
        <Camera size={13} />
      </span>
      <span className="interior-map__label">Камера</span>
    </div>
  );
}

export default function InteriorStudio() {
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const mountRef = useRef<HTMLDivElement>(null);
  const roomApi = useRef<RoomApi | null>(null);
  const refUrl = useRef<string | null>(null);
  const [camera, setCamera] = useState<CameraInfo>({ x: 7.2, y: 4.2, z: 7.4, tx: 0, tz: -0.6 });
  const [preset, setPreset] = useState("corner");
  const [room, setRoom] = useState("living");
  const [style, setStyle] = useState("warm");
  const [light, setLight] = useState("day");
  const [lens, setLens] = useState(38);
  const [furniture, setFurniture] = useState<Furniture>({ sofa: true, table: true, lamp: true, plant: true });
  const [notes, setNotes] = useState("Светлая комната для отдыха и общения, спокойная натуральная палитра");
  const [reference, setReference] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"scene" | "result">("scene");
  const [error, setError] = useState("");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x121614);
    scene.fog = new THREE.FogExp2(0x121614, 0.018);

    const camera3d = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    camera3d.position.set(7.2, 4.2, 7.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera3d, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, 1, -0.6);
    controls.minDistance = 4.6;
    controls.maxDistance = 15;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI / 2 - 0.025;
    controls.enablePan = true;
    controls.screenSpacePanning = false;

    const roomGroup = buildRoom(scene);
    const ambient = new THREE.HemisphereLight(0xfff2d7, 0x26322f, 1.35);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffdfb1, 3.1);
    sun.position.set(3.5, 7, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    scene.add(sun);
    const fill = new THREE.PointLight(0x9fe2d0, 20, 11, 2);
    fill.position.set(-3.8, 2.4, 3.2);
    scene.add(fill);

    const marker = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.025, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0xff716e }),
    );
    ring.rotation.x = Math.PI / 2;
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 18, 12),
      new THREE.MeshBasicMaterial({ color: 0xff716e }),
    );
    dot.position.y = 0.08;
    marker.add(ring, dot);
    marker.position.set(0, 0.09, -0.6);
    scene.add(marker);

    let cameraFrame = 0;
    let frame = 0;

    const updateCamera = () => {
      setCamera({
        x: camera3d.position.x,
        y: camera3d.position.y,
        z: camera3d.position.z,
        tx: controls.target.x,
        tz: controls.target.z,
      });
    };
    controls.addEventListener("end", updateCamera);

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera3d.aspect = width / height;
      camera3d.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const onDoubleClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(pointer, camera3d);
      const point = new THREE.Vector3();
      if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08), point)) return;
      point.x = THREE.MathUtils.clamp(point.x, -4.5, 4.5);
      point.z = THREE.MathUtils.clamp(point.z, -3.6, 3.4);
      controls.target.set(point.x, 1, point.z);
      marker.position.set(point.x, 0.09, point.z);
      controls.update();
      updateCamera();
    };
    renderer.domElement.addEventListener("dblclick", onDoubleClick);

    const animate = () => {
      controls.update();
      renderer.render(scene, camera3d);
      frame = requestAnimationFrame(animate);
    };
    animate();

    const palettes: Record<string, [number, number, number, number]> = {
      warm: [0xd8d1c4, 0x655b50, 0xb98a68, 0xb8a98f],
      nordic: [0xe1e4de, 0x877f74, 0x8eaaa5, 0xc8c1b5],
      modern: [0xc9c8c4, 0x414340, 0x596b68, 0xa2917d],
      japandi: [0xd6ccb9, 0x766a59, 0xa77c58, 0xb3a17e],
    };

    roomApi.current = {
      capture: () => {
        renderer.render(scene, camera3d);
        return renderer.domElement.toDataURL("image/png");
      },
      setFurniture: (name, visible) => {
        const item = roomGroup.getObjectByName(name);
        if (item) item.visible = visible;
      },
      setLens: (value) => {
        camera3d.fov = THREE.MathUtils.clamp(78 - value, 24, 60);
        camera3d.updateProjectionMatrix();
      },
      setLight: (value) => {
        const values: Record<string, [number, number, number, number]> = {
          day: [1.35, 3.1, 20, 1.05],
          evening: [0.72, 2.2, 36, 1.12],
          soft: [1.7, 1.4, 12, 0.96],
        };
        const next = values[value] ?? ([1.35, 3.1, 20, 1.05] as [number, number, number, number]);
        ambient.intensity = next[0];
        sun.intensity = next[1];
        fill.intensity = next[2];
        renderer.toneMappingExposure = next[3];
        sun.color.set(value === "evening" ? 0xffa96d : 0xffdfb1);
      },
      setPreset: (position) => {
        cancelAnimationFrame(cameraFrame);
        const from = camera3d.position.clone();
        const to = new THREE.Vector3(...position);
        const started = performance.now();
        const move = (now: number) => {
          const raw = Math.min(1, (now - started) / 520);
          const eased = 1 - Math.pow(1 - raw, 3);
          camera3d.position.lerpVectors(from, to, eased);
          controls.update();
          if (raw < 1) {
            cameraFrame = requestAnimationFrame(move);
          } else {
            updateCamera();
          }
        };
        cameraFrame = requestAnimationFrame(move);
      },
      setStyle: (value) => {
        const palette = palettes[value] ?? ([0xd8d1c4, 0x655b50, 0xb98a68, 0xb8a98f] as [number, number, number, number]);
        shellMaterialColor(roomGroup, palette);
      },
    };

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(cameraFrame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("dblclick", onDoubleClick);
      roomGroup.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
        else child.material.dispose();
      });
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      dot.geometry.dispose();
      (dot.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      roomApi.current = null;
    };
  }, []);

  useEffect(() => {
    roomApi.current?.setStyle(style);
  }, [style]);

  useEffect(() => {
    roomApi.current?.setLight(light);
  }, [light]);

  useEffect(() => {
    roomApi.current?.setLens(lens);
  }, [lens]);

  useEffect(() => {
    Object.entries(furniture).forEach(([name, visible]) => roomApi.current?.setFurniture(name, visible));
  }, [furniture]);

  useEffect(
    () => () => {
      if (refUrl.current) URL.revokeObjectURL(refUrl.current);
    },
    [],
  );

  const choosePreset = (id: string, position: [number, number, number]) => {
    setPreset(id);
    roomApi.current?.setPreset(position);
  };

  const toggleFurniture = (name: keyof Furniture) => {
    setFurniture((current) => ({ ...current, [name]: !current[name] }));
  };

  const chooseReference = (file?: File) => {
    if (!file) return;
    if (refUrl.current) URL.revokeObjectURL(refUrl.current);
    const url = URL.createObjectURL(file);
    refUrl.current = url;
    setReference(url);
  };

  const capture = () => {
    const image = roomApi.current?.capture();
    if (!image) return;
    setSnapshot(image);
    setView("result");
  };

  const generateBrief = async () => {
    if (!isAuthenticated) {
      setError("Войдите в аккаунт, чтобы создать проект.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const names: Record<string, string> = {
        sofa: "диван",
        table: "журнальный стол",
        lamp: "торшер",
        plant: "растение",
      };
      const enabled = Object.entries(furniture)
        .filter(([, visible]) => visible)
        .map(([name]) => names[name])
        .filter(Boolean)
        .join(", ");
      const roomName = roomLabels[room] || "гостиной";
      const styleName = styleLabels[style] || "теплый минимализм";
      const message = [
        `Подготовь практичную интерьерную концепцию ${roomName} в стиле «${styleName}».`,
        `Свет: ${light === "day" ? "дневной" : light === "evening" ? "вечерний" : "мягкий рассеянный"}.`,
        `Объектив виртуальной камеры: ${lens} мм. Камера: x ${camera.x.toFixed(1)}, y ${camera.y.toFixed(1)}, z ${camera.z.toFixed(1)}.`,
        `В кадре: ${enabled || "свободное пространство"}.`,
        `Пожелания: ${notes}.`,
        "Дай план зонирования, палитру с HEX, материалы, световой сценарий и список предметов. Ответ структурируй коротко и без вступления.",
      ].join("\n");
      const response = await sendChatMessage({ message, agentId: "general", language });
      setBrief(response.assistantMessage?.content || "Концепция создана, но текст ответа пуст.");
      const image = roomApi.current?.capture();
      if (image) setSnapshot(image);
      setView("result");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось создать концепцию.");
    } finally {
      setBusy(false);
    }
  };

  const copyBrief = async () => {
    if (!brief) return;
    await navigator.clipboard.writeText(brief);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const downloadSnapshot = () => {
    if (!snapshot) return;
    const link = document.createElement("a");
    link.href = snapshot;
    link.download = "nomduchat-interior.png";
    link.click();
  };

  const roomName = roomLabels[room] || "гостиная";
  const styleName = styleLabels[style] || "теплый минимализм";
  const roomTitle = roomName.charAt(0).toUpperCase() + roomName.slice(1);

  return (
    <section className="interior-studio">
      <div className="interior-stage">
        <div className="interior-stage__top">
          <div className="app-studio-segmented" aria-label="Режим просмотра">
            <button type="button" className={view === "scene" ? "is-active" : ""} onClick={() => setView("scene")}>
              3D-комната
            </button>
            <button type="button" className={view === "result" ? "is-active" : ""} onClick={() => setView("result")} disabled={!snapshot && !brief}>
              Результат
            </button>
          </div>
          <span className="interior-stage__hint">Тяните для поворота · колесо для масштаба · двойное нажатие задает точку взгляда</span>
        </div>

        <div className={`interior-viewport ${view === "result" ? "is-result" : ""}`}>
          <div ref={mountRef} className="interior-canvas" aria-label="Интерактивная трехмерная модель комнаты" />
          <div className="interior-axis">
            <span />
            <span />
            Камера вращается вокруг комнаты
          </div>
          <MiniMap camera={camera} />
          <div className="interior-camera-readout">
            <Camera size={15} />
            <span>x {camera.x.toFixed(1)}</span>
            <span>y {camera.y.toFixed(1)}</span>
            <span>z {camera.z.toFixed(1)}</span>
          </div>
          {view === "result" && (
            <div className="interior-result">
              {snapshot && <img src={snapshot} alt="Выбранный ракурс интерьера" />}
              <div className="interior-result__copy">
                <span className="app-studio-kicker">Концепция проекта</span>
                <h3>{roomTitle} · {styleName}</h3>
                {brief ? <p>{brief}</p> : <p>Ракурс сохранен. Создайте концепцию, чтобы получить материалы, палитру и план зонирования.</p>}
                <div className="app-studio-actions">
                  <button type="button" className="app-studio-button app-studio-button--ghost" onClick={downloadSnapshot} disabled={!snapshot}>
                    <Download size={17} /> Скачать ракурс
                  </button>
                  <button type="button" className="app-studio-button app-studio-button--ghost" onClick={copyBrief} disabled={!brief}>
                    {copied ? <Check size={17} /> : <Copy size={17} />} {copied ? "Скопировано" : "Копировать план"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="interior-presets">
          {cameraPresets.map((item) => (
            <button
              type="button"
              key={item.id}
              className={preset === item.id ? "is-active" : ""}
              onClick={() => choosePreset(item.id, item.position)}
            >
              <span className={`interior-preset-icon interior-preset-icon--${item.id}`} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <aside className="interior-controls app-studio-panel">
        <div className="interior-controls__heading">
          <span className="app-studio-kicker">Настройки пространства</span>
          <h2>Соберите комнату</h2>
          <p>Все параметры и результат остаются в этом приложении.</p>
        </div>

        <label className="app-studio-field">
          <span>Тип помещения</span>
          <select value={room} onChange={(event) => setRoom(event.target.value)}>
            <option value="living">Гостиная</option>
            <option value="bedroom">Спальня</option>
            <option value="office">Кабинет</option>
            <option value="kitchen">Кухня</option>
          </select>
        </label>

        <div className="app-studio-field">
          <span>Стиль</span>
          <div className="app-studio-choice-grid">
            {Object.entries(styleLabels).map(([id, label]) => (
              <button type="button" key={id} className={style === id ? "is-active" : ""} onClick={() => setStyle(id)}>
                <i className={`interior-swatch interior-swatch--${id}`} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="app-studio-field">
          <span>Мебель в сцене</span>
          <div className="interior-furniture">
            <button type="button" className={furniture.sofa ? "is-active" : ""} onClick={() => toggleFurniture("sofa")}>
              <Sofa size={19} /> Диван
            </button>
            <button type="button" className={furniture.table ? "is-active" : ""} onClick={() => toggleFurniture("table")}>
              <Table2 size={19} /> Стол
            </button>
            <button type="button" className={furniture.lamp ? "is-active" : ""} onClick={() => toggleFurniture("lamp")}>
              <LampFloor size={19} /> Свет
            </button>
            <button type="button" className={furniture.plant ? "is-active" : ""} onClick={() => toggleFurniture("plant")}>
              <Trees size={19} /> Растение
            </button>
          </div>
        </div>

        <div className="app-studio-field">
          <span>Освещение</span>
          <div className="app-studio-segmented app-studio-segmented--wide">
            {[
              ["day", "День"],
              ["evening", "Вечер"],
              ["soft", "Мягкий"],
            ].map(([id, label]) => (
              <button type="button" key={id} className={light === id ? "is-active" : ""} onClick={() => setLight(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="app-studio-field app-studio-field--range">
          <span>
            Объектив камеры <b>{lens} мм</b>
          </span>
          <input type="range" min="24" max="70" value={lens} onChange={(event) => setLens(Number(event.target.value))} />
          <small>Шире кадр</small>
          <small>Меньше искажений</small>
        </label>

        <label className="app-studio-field">
          <span>Пожелания к проекту</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
        </label>

        <label className="app-studio-upload app-studio-upload--compact">
          {reference ? <img src={reference} alt="Референс интерьера" /> : <Camera size={20} />}
          <span>
            <b>{reference ? "Референс добавлен" : "Добавить фото комнаты"}</b>
            <small>JPG, PNG или WebP</small>
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseReference(event.target.files?.[0])} />
        </label>

        {error && <p className="app-studio-error">{error}</p>}
        <div className="app-studio-actions app-studio-actions--stack">
          <button type="button" className="app-studio-button app-studio-button--primary" onClick={generateBrief} disabled={busy}>
            {busy ? <Loader2 className="is-spinning" size={18} /> : <Sofa size={18} />}
            {busy ? "Собираем проект" : "Создать концепцию"}
          </button>
          <button type="button" className="app-studio-button app-studio-button--ghost" onClick={capture}>
            <Camera size={18} /> Зафиксировать ракурс
          </button>
        </div>
      </aside>
    </section>
  );
}

function shellMaterialColor(room: THREE.Group, palette: [number, number, number, number]) {
  const [wall, floor, accent, rug] = palette;
  const meshes = room.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
  const floorMesh = meshes[0];
  if (floorMesh?.material instanceof THREE.MeshStandardMaterial) floorMesh.material.color.setHex(floor);
  for (const mesh of meshes.slice(1, 4)) {
    if (mesh.material instanceof THREE.MeshStandardMaterial) mesh.material.color.setHex(wall);
  }
  const sofa = room.getObjectByName("sofa");
  sofa?.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      child.material.color.lerp(new THREE.Color(accent), 0.62);
    }
  });
  const rugMesh = meshes.find((mesh) => mesh.geometry instanceof THREE.CylinderGeometry);
  if (rugMesh?.material instanceof THREE.MeshStandardMaterial) rugMesh.material.color.setHex(rug);
}
