import { Card, CardContent, CardHeader } from "@/components/ui/card";

const PROS = [
  { name: "Luis Hernández", skill: "Electricista", city: "Monterrey", rating: 4.8 },
  { name: "María López", skill: "Pintura", city: "San Pedro", rating: 4.6 },
  { name: "Carlos R.", skill: "Clima/AC", city: "Guadalupe", rating: 4.9 },
];

export default function Professionals() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Profesionales</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {PROS.map(p => (
          <Card key={p.name}>
            <CardHeader className="font-medium">{p.name}</CardHeader>
            <CardContent className="text-sm">
              <div>{p.skill}</div>
              <div className="text-neutral-500">{p.city}</div>
              <div>★ {p.rating}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
