import {
  Gamepad2, Ship, Palmtree, GraduationCap, Building2, Tent, FlaskConical,
  Drama, Atom, Server, Trophy, Shield, HeartPulse, Wind,
  type LucideIcon,
} from "lucide-react";

export type Subsidiary = {
  name: string;
  category: string;
  description: string;
  icon: LucideIcon;
  accent: "blue" | "purple" | "green";
};

export const subsidiaries: Subsidiary[] = [
  { name: "Furry's Life Studios", category: "Jogos & Mídia", description: "Estúdio de jogos e experiências digitais imersivas.", icon: Gamepad2, accent: "purple" },
  { name: "Furry's Life Cruise", category: "Turismo", description: "Companhia privada de cruzeiros de luxo.", icon: Ship, accent: "blue" },
  { name: "Furry Maldivas", category: "Hotelaria", description: "Hotel e resort cinco estrelas em destino paradisíaco.", icon: Palmtree, accent: "green" },
  { name: "Life College", category: "Educação", description: "Universidade privada com excelência acadêmica.", icon: GraduationCap, accent: "blue" },
  { name: "Furry's Life Cond.", category: "Imobiliário", description: "Condomínio privado de alto padrão.", icon: Building2, accent: "purple" },
  { name: "Furry's Life Camping", category: "Lazer", description: "Área de acampamento e atividades ao ar livre.", icon: Tent, accent: "green" },
  { name: "Furry's Life Labs", category: "Pesquisa", description: "Laboratório de pesquisas, ciência e inovação.", icon: FlaskConical, accent: "purple" },
  { name: "Furry's Life Theater", category: "Cultura", description: "Teatro e entretenimento cultural premium.", icon: Drama, accent: "purple" },
  { name: "Furry's Life Energy Complex", category: "Energia", description: "Complexo de geração de energia nuclear limpa.", icon: Atom, accent: "green" },
  { name: "Life Server", category: "Comunidades", description: "Servidores de Roblox e comunidades criativas.", icon: Server, accent: "blue" },
  { name: "Life Soccer", category: "Esportes", description: "Clube de futebol e organização de eventos esportivos.", icon: Trophy, accent: "green" },
  { name: "Life Agency", category: "Inteligência", description: "Agência de inteligência e operações especiais.", icon: Shield, accent: "blue" },
  { name: "Life+", category: "Saúde", description: "Serviços de saúde, bem-estar e medicina preventiva.", icon: HeartPulse, accent: "green" },
  { name: "Life AirCare", category: "Sustentabilidade", description: "Purificação do ar e tecnologias ambientais.", icon: Wind, accent: "blue" },
];

export const newsItems = [
  { date: "08 Jun 2026", tag: "Institucional", title: "Furry's Life Inc. anuncia nova holding em expansão global", description: "A organização principal apresenta seu plano de expansão para os próximos cinco anos com foco em sustentabilidade e tecnologia." },
  { date: "02 Jun 2026", tag: "Energia", title: "Energy Complex atinge 100% de operação", description: "O complexo nuclear conclui testes finais e entra em plena operação comercial, abastecendo todas as subsidiárias." },
  { date: "27 Mai 2026", tag: "Educação", title: "Life College abre inscrições para o semestre 2026.2", description: "Mais de 40 cursos disponíveis, com bolsas integrais para alunos destaque das comunidades parceiras." },
  { date: "19 Mai 2026", tag: "Tecnologia", title: "Life Server lança nova infraestrutura dedicada", description: "Servidores otimizados oferecem latência ultra baixa e novos recursos para comunidades criativas." },
];

export const admins = [
  { name: "Lobo_2033", role: "CEO & Fundador", status: "online" as const, avatar: "🐺" },
  { name: "Ariana_Vega", role: "Diretora de Operações", status: "online" as const, avatar: "🦊" },
  { name: "Kai_Storm", role: "CTO — Tecnologia", status: "online" as const, avatar: "🐉" },
  { name: "Mira_Lyn", role: "Diretora Financeira", status: "offline" as const, avatar: "🦌" },
  { name: "Rex_Halt", role: "Chefe de Segurança", status: "online" as const, avatar: "🦁" },
  { name: "Nova_Pine", role: "Diretora de Comunicação", status: "offline" as const, avatar: "🐱" },
];

export const internalNotices = [
  { date: "10 Jun 2026", title: "Reunião trimestral marcada para 15/06", body: "Todos os diretores devem confirmar presença na sala principal." },
  { date: "07 Jun 2026", title: "Nova política de acesso ao painel", body: "Autenticação em duas etapas será obrigatória a partir de julho." },
  { date: "01 Jun 2026", title: "Bem-vinda, Furry Maldivas!", body: "Subsidiária oficialmente integrada à holding principal." },
];
