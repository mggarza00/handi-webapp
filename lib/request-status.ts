export type RequestStatus =
  | "active"
  | "pending"
  | "scheduled"
  | "in_process"
  | "completed"
  | "finished"
  | "canceled"
  | "cancelled";

export const UI_STATUS_LABELS: Record<RequestStatus, string> = {
  active: "Activa",
  pending: "Activa",
  scheduled: "Agendada",
  in_process: "En proceso",
  completed: "Finalizada",
  finished: "Finalizada",
  canceled: "Cancelada",
  cancelled: "Cancelada",
};
