import ChatWindow from "../_components/ChatWindow";

export const dynamic = "force-dynamic";

export default function MensajeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  return (
    <div className="min-h-[100dvh] h-[100dvh] w-full">
      <ChatWindow conversationId={id} />
    </div>
  );
}
