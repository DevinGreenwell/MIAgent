import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { EffectComposer, SSAO, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import SchematicEngineRoom from "./SchematicEngineRoom";
import EngineRoomStructure from "./EngineRoomStructure";
import PipeNetwork from "./PipeNetwork";
import ViewerControls from "./ViewerControls";

export default function EngineRoomViewer() {
  return (
    <div className="relative h-full">
      <Canvas
        camera={{ position: [10, 7, 10], fov: 50 }}
        shadows
        gl={{ antialias: true, toneMapping: 0 }}
      >
        {/* Fog for atmospheric depth */}
        <fog attach="fog" args={["#1a1a2f", 18, 45]} />

        {/* Ambient fill */}
        <ambientLight intensity={0.5} color="#c0d0e8" />

        {/* Main overhead directional light with shadows */}
        <directionalLight
          position={[5, 12, 3]}
          intensity={1.2}
          color="#ffe8c0"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={30}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-bias={-0.001}
        />

        {/* Fill light from opposite side */}
        <directionalLight
          position={[-8, 6, -4]}
          intensity={0.4}
          color="#8090b0"
        />

        {/* Engine room hull, deck, frames, catwalks, lighting fixtures */}
        <EngineRoomStructure />

        {/* Pipe runs connecting systems */}
        <PipeNetwork />

        {/* Equipment components */}
        <SchematicEngineRoom />

        <OrbitControls
          enablePan={true}
          maxDistance={30}
          minDistance={2}
          target={[0, 1.5, 0]}
          maxPolarAngle={Math.PI * 0.85}
        />

        <Environment preset="warehouse" background={false} />

        {/* Post-processing */}
        <EffectComposer>
          <SSAO
            radius={0.4}
            intensity={25}
            luminanceInfluence={0.5}
            worldDistanceThreshold={8}
            worldDistanceFalloff={2}
            worldProximityThreshold={0.4}
            worldProximityFalloff={0.3}
          />
          <Bloom
            luminanceThreshold={0.9}
            luminanceSmoothing={0.5}
            intensity={0.4}
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette darkness={0.2} offset={0.4} />
        </EffectComposer>
      </Canvas>

      <div className="absolute top-4 left-4 z-10">
        <ViewerControls />
      </div>
    </div>
  );
}
