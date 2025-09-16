import { redirect } from "next/navigation";

export default function ConversationPage({ params }: { params: { id: string } }) {
  const { id } = params;
  redirect(`/mensajes/${id}`);
}
