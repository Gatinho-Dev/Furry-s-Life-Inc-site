import { HardDrive, FileText, Sheet, Presentation, Calendar, ClipboardList, CheckSquare, Video, MessageSquare, Sparkles, Shield, type LucideIcon } from "lucide-react";

/** Registro central das ferramentas do Life Workspace. Adicione novas aqui. */
export type WorkspaceApp = {
  key: string;
  name: string;
  description: string;
  path: string;
  icon: LucideIcon;
  available: boolean;
};

export const WORKSPACE_APPS: WorkspaceApp[] = [
  { key: "drive", name: "Life Drive", description: "Armazene, organize e compartilhe seus arquivos.", path: "/workspace/drive", icon: HardDrive, available: true },
  { key: "docs", name: "Life Docs", description: "Documentos colaborativos.", path: "/workspace/docs", icon: FileText, available: false },
  { key: "sheets", name: "Life Sheets", description: "Planilhas.", path: "/workspace/sheets", icon: Sheet, available: false },
  { key: "slides", name: "Life Slides", description: "Apresentações.", path: "/workspace/slides", icon: Presentation, available: false },
  { key: "calendar", name: "Life Calendar", description: "Agenda.", path: "/workspace/calendar", icon: Calendar, available: false },
  { key: "forms", name: "Life Forms", description: "Formulários.", path: "/workspace/forms", icon: ClipboardList, available: false },
  { key: "tasks", name: "Life Tasks", description: "Tarefas.", path: "/workspace/tasks", icon: CheckSquare, available: false },
  { key: "meet", name: "Life Meet", description: "Videochamadas.", path: "/workspace/meet", icon: Video, available: false },
  { key: "chat", name: "Life Chat", description: "Mensagens.", path: "/workspace/chat", icon: MessageSquare, available: false },
  { key: "ai", name: "Life AI", description: "Assistente inteligente.", path: "/workspace/ai", icon: Sparkles, available: false },
  { key: "admin", name: "Life Admin", description: "Administração.", path: "/workspace/admin", icon: Shield, available: false },
];

/** Permissões compartilhadas por todas as ferramentas. */
export type Permission = "view" | "comment" | "edit" | "owner";
export const PERMISSION_LABEL: Record<Permission, string> = {
  view: "Visualizar", comment: "Comentar", edit: "Editar", owner: "Proprietário",
};
