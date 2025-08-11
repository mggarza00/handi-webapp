import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Panel</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader>Profesionales activos</CardHeader><CardContent><div className="text-3xl font-bold">128</div></CardContent></Card>
        <Card><CardHeader>Solicitudes abiertas</CardHeader><CardContent><div className="text-3xl font-bold">42</div></CardContent></Card>
        <Card><CardHeader>Calificación promedio</CardHeader><CardContent><div className="text-3xl font-bold">4.7</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader>Actividad reciente</CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>Juan Pérez se postuló a “Pintura de recámara”.</li>
            <li>Solicitud “Reparación de fuga” fue marcada como Completada.</li>
            <li>Laura G. recibió una reseña 5★.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
