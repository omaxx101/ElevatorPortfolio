import ElevatorSimulation from '@/app/components/ElevatorSimulation';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="container mx-auto p-8">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold text-white mb-3">3D Elevator Control System</h1>
          <p className="text-blue-200 text-lg">
            Interactive demonstration of mechatronics engineering and control systems
          </p>
        </div>
        <ElevatorSimulation />
      </div>
    </div>
  );
}
