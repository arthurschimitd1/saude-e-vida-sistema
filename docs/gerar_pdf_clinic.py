from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
import os

W,H=960,540
NAVY=HexColor('#071D3E'); BLUE=HexColor('#2784FF'); CYAN=HexColor('#19B8C8')
INK=HexColor('#10213B'); MUTED=HexColor('#65758A'); LINE=HexColor('#DFE7F0'); SOFT=HexColor('#F4F8FC'); GREEN=HexColor('#16A06A')
OUT=os.path.join(os.path.dirname(__file__),'Lucro-Mais-Clinic-Apresentacao-Comercial.pdf')
LOGO=os.path.join(os.path.dirname(__file__),'../frontend/public/layout/images/lucro+logo.png')

pages=[
('Quem é a Lucro Mais','Tecnologia que transforma gestão em crescimento',['Inovação aplicada à operação','Segurança e rastreabilidade','Automação de processos','Inteligência de negócios','Suporte especializado','Escalabilidade para crescer']),
('Os desafios das clínicas','O crescimento trava quando a operação fica fragmentada',['Agenda desorganizada','Pacientes esquecem consultas','Atendimento lento e excesso de mensagens','Perda de pacientes e baixa fidelização','Financeiro e estoque manuais','Dados espalhados e falta de indicadores']),
('A solução','Uma única plataforma. Toda a clínica conectada.',['Paciente','WhatsApp','CRM','Agenda','Prontuário','Financeiro','Estoque e farmácia','Relatórios e indicadores']),
('Cadastro inteligente','Cada paciente em uma visão completa e acionável',['Dados pessoais e contatos','CPF, convênio e responsável financeiro','Histórico completo e observações','Fotos, documentos e anexos','Tags e classificação','Aniversários e oportunidades']),
('CRM para clínicas','Relacionamento que acompanha toda a jornada',['Novo paciente','Primeiro contato','Orçamento enviado','Consulta agendada','Tratamento e retorno','Paciente fidelizado']),
('WhatsApp + IA','Atendimento inteligente, humano e conectado',['Resumo automático da conversa','Sugestões de respostas','Transferência entre atendentes','Histórico e etiquetas','Integração com CRM e agenda','Mensagens rápidas e arquivos']),
('Automações','Da confirmação à fidelização — automaticamente',['Confirmação ao agendar','Lembrete 24h antes','Lembrete 2h antes','Pesquisa de satisfação','Avaliação no Google','Campanhas de retorno e aniversário']),
('Agenda inteligente','Uma agenda que trabalha junto com a equipe',['Visão diária, semanal e mensal','Filtros por profissional e sala','Bloqueios e reagendamentos','Lista de espera','Confirmações pelo WhatsApp','Mais ocupação e menos faltas']),
('Controle financeiro','Decisões mais seguras com dados claros',['Receitas e despesas','Fluxo de caixa','Contas a pagar e receber','Centro de custos','Indicadores e gráficos','Relatórios gerenciais']),
('Estoque e farmácia','Do recebimento ao consumo, cada item é rastreado',['Medicamentos, materiais e insumos','Lotes, validade e estoque mínimo','Código de barras e inventário','Transferências e alertas','Consumo por procedimento','Histórico e rastreabilidade']),
('Protocolos','Baixa automática de materiais após o atendimento',['Seringas e agulhas','Lidocaína e anestésicos','Ácido hialurônico','Luvas e gazes','Registro de lotes e custos','Estoque atualizado em tempo real']),
('Inteligência Artificial','Dados que se transformam em próximos passos',['Resumo de conversas','Sugestões de atendimento','Alertas operacionais','Análise de pacientes','Campanhas inteligentes','Insights de vendas']),
('Dashboards','Indicadores claros para uma gestão mais inteligente',['Faturamento e lucro','Pacientes novos e recorrentes','Ticket médio e conversão','Cancelamentos e ocupação','Performance de profissionais','Produtos e procedimentos']),
('Segurança e LGPD','Proteção em cada acesso, dado e decisão',['LGPD e boas práticas','Backups recorrentes','Criptografia','Permissões por função','Logs de acesso','Auditoria e rastreabilidade']),
('Benefícios','Uma operação melhor para todos',['Mais organização','Mais produtividade','Mais pacientes','Mais fidelização','Mais controle','Mais faturamento','Mais segurança','Mais eficiência']),
('Implantação','Do diagnóstico à operação, com acompanhamento',['1. Diagnóstico','2. Configuração','3. Migração aplicável','4. Treinamento da equipe','5. Operação assistida','6. Acompanhamento contínuo']),
]

def rr(c,x,y,w,h,r,fill,stroke=None):
 c.setFillColor(fill); c.setStrokeColor(stroke or fill); c.roundRect(x,y,w,h,r,fill=1,stroke=1 if stroke else 0)
def txt(c,s,x,y,size=12,color=INK,font='Helvetica',maxw=None):
 c.setFont(font,size); c.setFillColor(color)
 if maxw and stringWidth(s,font,size)>maxw:
  while size>7 and stringWidth(s,font,size)>maxw:size-=.5;c.setFont(font,size)
 c.drawString(x,y,s)
def logo(c,dark=False,x=48,y=480,w=128):
 if dark:
  rr(c,x,y+5,31,31,7,BLUE);txt(c,'L',x+10,y+14,15,white,'Helvetica-Bold');txt(c,'Lucro+',x+40,y+12,25,white,'Helvetica-Bold')
 else:
  try:c.drawImage(ImageReader(LOGO),x,y,w,w,mask='auto',preserveAspectRatio=True,anchor='w')
  except:txt(c,'Lucro+',x,y+20,28,BLUE,'Helvetica-Bold')
def header(c,kicker,title,n,dark=False):
 logo(c,dark); txt(c,kicker.upper(),48,458,9,CYAN if dark else BLUE,'Helvetica-Bold'); txt(c,title,48,421,27,white if dark else INK,'Helvetica-Bold',760);txt(c,f'{n:02d} / 20',860,478,9,HexColor('#8DA2BA'))
def footer(c,dark=False):
 txt(c,'LUCRO MAIS CLINIC  •  APRESENTAÇÃO COMERCIAL',48,24,7,HexColor('#7891AC') if dark else HexColor('#94A1B4'));txt(c,'© 2026 LUCRO MAIS',820,24,7,HexColor('#7891AC') if dark else HexColor('#94A1B4'))
def pill(c,s,x,y,color=BLUE):
 w=stringWidth(s,'Helvetica-Bold',8)+22;rr(c,x,y,w,24,12,Color(color.red,color.green,color.blue,.10));txt(c,s,x+11,y+8,8,color,'Helvetica-Bold');return w
def cards(c,items,y0=340,cols=3,dark=False):
 gap=14; x0=48; total=864; w=(total-gap*(cols-1))/cols; h=102
 for i,s in enumerate(items):
  col=i%cols;row=i//cols;x=x0+col*(w+gap);y=y0-row*(h+14)
  fill=Color(1,1,1,.08) if dark else white; stroke=Color(1,1,1,.14) if dark else LINE
  rr(c,x,y,w,h,12,fill,stroke); rr(c,x+15,y+57,30,30,8,Color(.15,.52,1,.18));txt(c,f'{i+1:02d}',x+22,y+68,8,CYAN if dark else BLUE,'Helvetica-Bold');txt(c,s,x+55,y+68,11,white if dark else INK,'Helvetica-Bold',w-68);txt(c,'Conectado à gestão da clínica',x+15,y+25,8,HexColor('#AFC2D8') if dark else MUTED)
def cover(c):
 c.setFillColor(NAVY);c.rect(0,0,W,H,fill=1,stroke=0);c.setFillColor(Color(.08,.38,.85,.35));c.circle(870,535,210,fill=1,stroke=0);logo(c,True,52,460,155)
 txt(c,'TECNOLOGIA PARA SAÚDE',52,402,10,CYAN,'Helvetica-Bold');txt(c,'Lucro Mais',52,329,52,white,'Helvetica-Bold');txt(c,'Clinic',52,270,52,HexColor('#56A9FF'),'Helvetica-Bold');txt(c,'A plataforma inteligente para a gestão',52,220,18,HexColor('#D5E4F4'));txt(c,'completa da sua clínica.',52,194,18,HexColor('#D5E4F4'))
 x=52
 for s in ['Gestão','Automação','Inteligência Artificial']:x+=pill(c,s,x,140,CYAN)+8
 rr(c,555,92,345,340,18,white);txt(c,'Visão executiva',578,400,10,MUTED,'Helvetica-Bold')
 for i,(a,b,u) in enumerate([('Faturamento','R$ 184 mil','+18,4%'),('Pacientes ativos','1.248','+12,1%')]):
  x=578+i*150;rr(c,x,320,136,62,9,SOFT);txt(c,a,x+12,362,8,MUTED);txt(c,b,x+12,339,16,INK,'Helvetica-Bold');txt(c,u,x+85,341,8,GREEN,'Helvetica-Bold')
 vals=[50,72,64,104,125,162,195]
 for i,v in enumerate(vals):rr(c,580+i*42,135,24,v,5,HexColor('#DCEBFC'));rr(c,580+i*42,135,24,v*(.45+i*.07),5,BLUE)
 footer(c,True);c.showPage()
def standard(c,n,k,t,items):
 c.setFillColor(SOFT if n in [3,10,15] else white);c.rect(0,0,W,H,fill=1,stroke=0);header(c,k,t,n)
 if n in [4,7,8,12,17]:
  x=58
  for i,s in enumerate(items):
   rr(c,x,250,125,100,14,white,LINE);rr(c,x+43,316,38,38,10,Color(.15,.52,1,.12));txt(c,f'{i+1:02d}',x+53,330,9,BLUE,'Helvetica-Bold');txt(c,s,x+12,282,9,INK,'Helvetica-Bold',102)
   if i<len(items)-1:txt(c,'→',x+132,290,16,BLUE,'Helvetica-Bold')
   x+=143
  rr(c,145,170,670,44,12,NAVY);txt(c,'Informação certa  →  processo automatizado  →  decisão mais inteligente',215,187,11,white,'Helvetica-Bold')
 else:cards(c,items,330,3)
 footer(c);c.showPage()
def investment(c):
 c.setFillColor(white);c.rect(0,0,W,H,fill=1,stroke=0);header(c,'INVESTIMENTO','Implantação completa para começar do jeito certo',18)
 txt(c,'Estruturamos sistema, dados e equipe para uma entrada segura e organizada.',48,380,14,MUTED)
 inc=['Configuração completa','Parametrização da clínica','Cadastro e estrutura inicial','Usuários e permissões','Estoque e financeiro','CRM e WhatsApp','Integrações necessárias','Migração aplicável','Treinamento completo','Operação assistida','Acompanhamento','Suporte prioritário']
 for i,s in enumerate(inc):
  x=48+(i%2)*240;y=342-(i//2)*42;rr(c,x,y,20,20,10,HexColor('#E3F6EE'));txt(c,'✓',x+5,y+6,9,GREEN,'Helvetica-Bold');txt(c,s,x+30,y+6,9,INK)
 rr(c,565,104,345,290,20,NAVY);txt(c,'IMPLANTAÇÃO COMPLETA',592,355,9,CYAN,'Helvetica-Bold');txt(c,'Investimento único',592,315,10,HexColor('#AFC5DC'));txt(c,'R$',592,257,21,white,'Helvetica-Bold');txt(c,'2.000',630,240,45,white,'Helvetica-Bold');txt(c,',00',771,257,21,white,'Helvetica-Bold');txt(c,'Pagamento no ato da assinatura do contrato.',592,200,9,HexColor('#B8CBE0'));c.setStrokeColor(Color(1,1,1,.18));c.line(592,175,880,175);txt(c,'✓  Implantação acompanhada por especialistas',592,142,9,HexColor('#74E0B5'),'Helvetica-Bold');footer(c);c.showPage()
def monthly(c):
 c.setFillColor(SOFT);c.rect(0,0,W,H,fill=1,stroke=0);header(c,'MENSALIDADE','Tudo o que sua clínica precisa em um plano completo',19)
 feats=['CRM para clínicas','Cadastro de pacientes','Agenda inteligente','Automação de WhatsApp','Controle financeiro','Estoque e farmácia','Protocolos automáticos','Relatórios gerenciais','Dashboard executivo','Atualizações constantes','Backup e segurança','Suporte especializado']
 for i,s in enumerate(feats):
  x=48+(i%2)*225;y=348-(i//2)*39;rr(c,x,y,18,18,9,HexColor('#E3F6EE'));txt(c,'✓',x+4,y+5,8,GREEN,'Helvetica-Bold');txt(c,s,x+27,y+5,9,INK)
 rr(c,545,150,365,250,20,white,LINE);txt(c,'PLANO COMPLETO',572,365,9,BLUE,'Helvetica-Bold');txt(c,'R$',572,297,19,INK,'Helvetica-Bold');txt(c,'400',608,280,48,INK,'Helvetica-Bold');txt(c,'/mês',720,295,14,MUTED);rr(c,572,235,235,27,13,HexColor('#E1F6EC'));txt(c,'Primeira mensalidade após 30 dias',586,245,9,GREEN,'Helvetica-Bold');txt(c,'Tempo para implantar, treinar e começar',572,200,9,MUTED);txt(c,'a utilizar a plataforma com segurança.',572,184,9,MUTED)
 rr(c,48,73,862,48,12,NAVY);txt(c,'Comece hoje. A mensalidade inicia apenas após o primeiro mês de uso.',184,91,11,white,'Helvetica-Bold');footer(c);c.showPage()
def closing(c):
 c.setFillColor(NAVY);c.rect(0,0,W,H,fill=1,stroke=0);c.setFillColor(Color(.08,.38,.85,.35));c.circle(900,520,220,fill=1,stroke=0);logo(c,True,52,460,155);txt(c,'O PRÓXIMO PASSO COMEÇA AGORA',52,395,10,CYAN,'Helvetica-Bold');txt(c,'Sua clínica merece',52,330,42,white,'Helvetica-Bold');txt(c,'uma gestão inteligente.',52,280,42,HexColor('#56A9FF'),'Helvetica-Bold');txt(c,'Automatize processos. Encante pacientes. Aumente a produtividade.',52,226,14,HexColor('#C9DAEC'));rr(c,52,143,270,52,12,BLUE);txt(c,'Solicite uma demonstração  →',78,163,12,white,'Helvetica-Bold');rr(c,650,120,210,240,18,white);txt(c,'Fale com nosso time',688,310,13,INK,'Helvetica-Bold')
 for r in range(9):
  for col in range(9):
   if (r*7+col*3+r%2)%4<2 or (r<3 and col<3) or (r>5 and col>5):c.setFillColor(NAVY);c.rect(688+col*14,165+r*14,10,10,fill=1,stroke=0)
 txt(c,'Aponte a câmera para o QR Code',684,140,8,MUTED);footer(c,True);c.showPage()

c=canvas.Canvas(OUT,pagesize=(W,H));c.setTitle('Lucro Mais Clinic — Apresentação Comercial');c.setAuthor('Lucro Mais')
cover(c)
for idx,p in enumerate(pages,start=2):standard(c,idx,*p)
investment(c);monthly(c);closing(c);c.save();print(OUT)
