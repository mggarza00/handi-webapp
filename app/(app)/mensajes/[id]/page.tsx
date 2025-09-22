import ChatWindow from "../_components/ChatWindow";

export const dynamic = "force-dynamic";

export default function MensajeDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <div className="h-[calc(100vh-8rem)]">
      <ChatWindow conversationId={id} />
    </div>
  );
}

