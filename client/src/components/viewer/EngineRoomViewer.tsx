import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import SchematicEngineRoom from "./SchematicEngineRoom";
import ViewerControls from "./ViewerControls";

export default function EngineRoomViewer() {
  return (
    <div className="relative h-full">
      <Canvas camera={{ position: [8, 6, 8], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <directionalLight position={[-5, 5, -5]} intensity={0.3} />
        <SchematicEngineRoom />
        <OrbitControls maxDistance={20} minDistance={3} />
        <Environment preset="warehouse" />
        <gridHelper args={[20, 20, "#555", "#333"]} />
      </Canvas>

      <div className="absolute top-4 left-4 z-10">
        <ViewerControls />
      </div>
    </div>
  );
}
