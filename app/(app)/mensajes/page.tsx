export const dynamic = "force-dynamic";

export default function MensajesEmptyPage() {
  return (
    <div className="h-[50vh] md:h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="text-center text-sm text-muted-foreground">
        Elige una conversación de la lista para comenzar.
      </div>
    </div>
  );
}

