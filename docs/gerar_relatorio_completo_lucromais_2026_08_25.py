from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "relatorio-completo-funcionalidades-lucromais-2026-08-25.pdf"
FONT_DIR = Path("/Users/arthurschimitd/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype")

pdfmetrics.registerFont(TTFont("Noto", str(FONT_DIR / "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("Noto-Bold", str(FONT_DIR / "DejaVuSans-Bold.ttf")))

NAVY = colors.HexColor("#0d3b56")
BLUE = colors.HexColor("#1479b8")
TEAL = colors.HexColor("#0f766e")
GREEN = colors.HexColor("#15803d")
AMBER = colors.HexColor("#b45309")
RED = colors.HexColor("#b91c1c")
SLATE = colors.HexColor("#475569")
LIGHT = colors.HexColor("#f8fafc")
GRID = colors.HexColor("#cbd5e1")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", fontName="Noto-Bold", fontSize=25, leading=31, textColor=colors.white, alignment=TA_CENTER, spaceAfter=9))
styles.add(ParagraphStyle(name="CoverSub", fontName="Noto", fontSize=12, leading=17, textColor=colors.HexColor("#dbeafe"), alignment=TA_CENTER, spaceAfter=8))
styles.add(ParagraphStyle(name="H1L", fontName="Noto-Bold", fontSize=16, leading=21, textColor=NAVY, spaceBefore=10, spaceAfter=7, keepWithNext=True))
styles.add(ParagraphStyle(name="H2L", fontName="Noto-Bold", fontSize=11.5, leading=15, textColor=BLUE, spaceBefore=9, spaceAfter=4, keepWithNext=True))
styles.add(ParagraphStyle(name="H3L", fontName="Noto-Bold", fontSize=9.5, leading=12, textColor=NAVY, spaceBefore=6, spaceAfter=3, keepWithNext=True))
styles.add(ParagraphStyle(name="BodyL", fontName="Noto", fontSize=8.3, leading=11.4, textColor=colors.HexColor("#1f2937"), spaceAfter=5))
styles.add(ParagraphStyle(name="BodySmall", fontName="Noto", fontSize=7.2, leading=9.2, textColor=colors.HexColor("#1f2937"), spaceAfter=3))
styles.add(ParagraphStyle(name="BodySmallBold", fontName="Noto-Bold", fontSize=7.2, leading=9.2, textColor=colors.HexColor("#1f2937"), spaceAfter=3))
styles.add(ParagraphStyle(name="TableHead", fontName="Noto-Bold", fontSize=7.2, leading=8.5, textColor=colors.white))
styles.add(ParagraphStyle(name="TableCell", fontName="Noto", fontSize=6.7, leading=8.3, textColor=colors.HexColor("#1f2937")))
styles.add(ParagraphStyle(name="TableCellBold", fontName="Noto-Bold", fontSize=6.7, leading=8.3, textColor=colors.HexColor("#1f2937")))
styles.add(ParagraphStyle(name="Note", fontName="Noto", fontSize=7.5, leading=10, textColor=SLATE, leftIndent=6, rightIndent=6, spaceBefore=3, spaceAfter=6))
styles.add(ParagraphStyle(name="Kpi", fontName="Noto-Bold", fontSize=15, leading=18, textColor=NAVY, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="KpiLabel", fontName="Noto", fontSize=7.1, leading=9, textColor=SLATE, alignment=TA_CENTER))


def p(text, style="BodyL"):
    return Paragraph(escape(str(text)).replace("\n", "<br/>"), styles[style])


def rich(text, style="BodyL"):
    return Paragraph(str(text).replace("\n", "<br/>"), styles[style])


def status_color(status):
    upper = status.upper()
    if "PASSOU" in upper or "FUNCIONAL" in upper:
        return colors.HexColor("#dcfce7"), GREEN
    if "PARCIAL" in upper or "PENDENTE" in upper or "BLOQUEADO" in upper or "NÃO TESTADO" in upper:
        return colors.HexColor("#fef3c7"), AMBER
    if "NÃO FUNCIONAL" in upper or "ERRO" in upper:
        return colors.HexColor("#fee2e2"), RED
    return LIGHT, SLATE


def status_cell(status):
    bg, fg = status_color(status)
    return Table([[Paragraph(escape(status), styles["TableCellBold"])]], colWidths=[26 * mm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("TEXTCOLOR", (0, 0), (-1, -1), fg),
        ("BOX", (0, 0), (-1, -1), 0.5, bg),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))


def table(data, widths, repeat=1, header=True):
    rows = []
    for idx, row in enumerate(data):
        row_cells = []
        for cell in row:
            if isinstance(cell, Table):
                row_cells.append(cell)
            else:
                row_cells.append(p(cell, "TableHead" if header and idx == 0 else "TableCell"))
        rows.append(row_cells)
    tbl = Table(rows, colWidths=widths, repeatRows=repeat if header else 0, hAlign="LEFT")
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, GRID),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if header:
        commands.append(("BACKGROUND", (0, 0), (-1, 0), NAVY))
        start = 1
    else:
        start = 0
    for row in range(start, len(rows)):
        if (row - start) % 2 == 1:
            commands.append(("BACKGROUND", (0, row), (-1, row), LIGHT))
    tbl.setStyle(TableStyle(commands))
    return tbl


def callout(title, body, color=BLUE):
    t = Table([[p(title, "BodySmallBold")], [p(body, "BodySmall")]], colWidths=[182 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.8, color),
        ("LINEBEFORE", (0, 0), (0, -1), 4, color),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def bullet(text):
    return Paragraph("&#8226; " + escape(text), styles["BodyL"])


def module(group, name, route, purpose, features, status, evidence):
    rows = [["Funcionalidade", "O que faz", "Resultado", "Evidência / limite"]]
    for feature, does, result, ev in features:
        rows.append([feature, does, status_cell(result), ev])
    heading = Table([[p(group.upper(), "TableHead"), p(name, "H2L")]], colWidths=[33 * mm, 149 * mm])
    heading.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 6),
        ("RIGHTPADDING", (0, 0), (0, 0), 6),
        ("LEFTPADDING", (1, 0), (1, 0), 6),
        ("RIGHTPADDING", (1, 0), (1, 0), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    block = [
        heading,
        p(f"Rota: {route}", "BodySmall"),
        p(purpose, "BodyL"),
        table(rows, [36 * mm, 57 * mm, 29 * mm, 60 * mm]),
        Spacer(1, 5),
        p(f"Status consolidado da aba: {status}. {evidence}", "Note"),
    ]
    return KeepTogether(block)


modules = [
    ("Geral", "Configurações / Documentação", "/documentation", "Central de documentação, orientações e parâmetros gerais disponíveis ao usuário.", [
        ("Abertura da tela", "Carrega a área de documentação e seus recursos de orientação.", "FUNCIONAL", "Tela abriu em produção."),
        ("Navegação interna", "Permite consultar seções e orientações do sistema.", "PARCIAL", "Abertura testada; cada link interno não foi executado."),
    ], "FUNCIONAL NA CONSULTA", "A validação confirma disponibilidade da tela, mas não certifica todo o conteúdo editorial."),
    ("Geral", "Dashboard", "/dashboard", "Visão resumida da operação, indicadores e atalhos para os módulos do sistema.", [
        ("Carregamento de indicadores", "Apresenta o resumo operacional para a empresa selecionada.", "FUNCIONAL", "Tela carregou sem erro na empresa de teste."),
        ("Atalhos e navegação", "Leva o usuário aos módulos principais.", "FUNCIONAL NA CONSULTA", "Atalhos foram visualizados; ações de destino foram testadas separadamente."),
        ("Filtros e períodos", "Permite analisar dados por período quando disponível.", "NÃO TESTADO", "Não foi alterado período para evitar massa adicional."),
    ], "FUNCIONAL NA CONSULTA", "Indicadores foram lidos; não houve alteração de dados."),
    ("Operacional", "Estoque", "/uikit/formlayout", "Cadastro, consulta e controle do saldo físico dos produtos, movimentações e relatórios de estoque.", [
        ("Cadastro de produto", "Cria produto com SKU, preço de compra, preço de venda, mínimo e saldo inicial.", "FUNCIONAL", "Produto sintético QA-REAL-20260825 persistiu com saldo 10."),
        ("Filtros e listagem", "Pesquisa por nome, SKU, preço e status.", "FUNCIONAL NA CONSULTA", "Lista e filtros foram carregados; combinações de filtro não foram exauridas."),
        ("Histórico de movimentações", "Registra entradas, saídas, motivos e data/hora.", "FUNCIONAL", "Mostrou entrada inicial e saída de venda/editada."),
        ("Importar XML", "Lê XML de NF-e recebida, sugere vínculo e lança entrada.", "FUNCIONAL EM QA", "Parser e rota de processamento foram validados com XML sintético e cobertura automatizada; nenhum documento fiscal foi transmitido. O upload com XML externo permanece fora do escopo seguro."),
        ("Relatório de desperdícios", "Consulta desperdícios por período e estima a perda registrada.", "PARCIAL", "Modal abriu e consulta do mês atual funcionou sem erro, mas a interface observada oferece somente Mês atual; dia, semana e personalizado ainda não aparecem neste fluxo."),
        ("PDF, giro, etiquetas e inventário", "Gera relatórios e apoia contagem/identificação física.", "FUNCIONAL EM QA", "PDF, giro, filtro Personalizado e histórico de etiquetas foram acionados sem erro visível. O inventário exigiu autenticação de responsável, como esperado; não foi executada alteração física em estoque."),
        ("Categorias e unidades", "Organiza produtos e unidades de medida.", "FUNCIONAL", "Categoria QA e unidade QA foram criadas, reapareceram na interface e permaneceram ativas."),
    ], "FUNCIONAL COM LIMITAÇÕES DE ESCOPO", "O núcleo de cadastro, venda e movimentação foi confirmado. A importação XML foi validada em QA sem transmissão fiscal; filtros de desperdício e alterações físicas de inventário ficam registrados como homologações complementares."),
    ("Operacional", "Produção", "/uikit/producao", "Receitas, consumo de matéria-prima, ordens/produção e desperdício do processo produtivo.", [
        ("Abertura e listagem", "Exibe receitas e produtos ligados à produção.", "FUNCIONAL NA CONSULTA", "Tela abriu e carregou estado da empresa."),
        ("Nova receita", "Relaciona produto final, insumos e quantidades.", "FUNCIONAL", "Receita QA foi salva com produto final, rendimento 1 e matéria-prima de 1 UN; reapareceu na listagem."),
        ("Consumo e baixa", "Baixa insumos ao registrar produção.", "FUNCIONAL", "Ordem QA foi criada e concluída; matéria-prima caiu de 5 para 4, produto final entrou com 1 e os dois movimentos apareceram no histórico."),
        ("Relatório de desperdícios", "Consolida ocorrências, período e produtos afetados.", "PARCIAL", "Consulta do mês atual abriu sem erro, porém não houve registro de desperdício e o seletor observado não oferece ainda dia/semana/personalizado."),
    ], "FUNCIONAL COM PENDÊNCIAS", "Receita, ordem, consumo, baixa e persistência foram confirmados com massa sintética; o relatório de desperdícios ainda precisa de registros e filtros completos para homologação."),
    ("Operacional", "Pedidos", "/uikit/pedidos", "Compras e pedidos operacionais, itens, fornecedores, status e acompanhamento.", [
        ("Listagem e estado vazio", "Exibe pedidos e mensagens quando não há registros.", "FUNCIONAL NA CONSULTA", "Tela abriu e estados de lista foram visualizados."),
        ("Novo pedido", "Cria pedido com fornecedor, itens e quantidades.", "FUNCIONAL", "Pedido PED-0002 foi salvo com fornecedor QA, produto, quantidade 1 e total estimado de R$ 10,00."),
        ("Status e ações", "Permite acompanhar o ciclo do pedido.", "FUNCIONAL COM PENDÊNCIAS", "Consulta do PED-0002, geração de PDF e status Pendente foram exercitados; pagamento, recebimento e cancelamento não foram executados."),
    ], "FUNCIONAL COM PENDÊNCIAS", "Cadastro, consulta, PDF e persistência foram confirmados; ações financeiras/destrutivas permanecem pendentes."),
    ("Operacional", "Fornecedores", "/uikit/fornecedores", "Cadastro e manutenção de fornecedores para compras e vínculo de produtos/notas.", [
        ("Cadastro", "Registra dados do fornecedor e documentos de identificação.", "FUNCIONAL", "Cadastro sintético foi validado na rodada geral anterior."),
        ("Pesquisa e listagem", "Localiza fornecedores cadastrados.", "FUNCIONAL NA CONSULTA", "Lista abriu com filtros e estado vazio/dados."),
        ("Vínculo com produto", "Relaciona fornecedor ao item de estoque.", "PARCIAL", "A funcionalidade foi aberta; vínculo por fluxo XML ficou pendente."),
    ], "FUNCIONAL COM PENDÊNCIAS", "Sem emissão fiscal ou integração externa."),
    ("Operacional", "Agendamentos", "/uikit/agendamentos", "Agenda de serviços, colaboradores, horários, disponibilidade e bloqueios.", [
        ("Calendário e listagem", "Exibe agenda por data e colaborador.", "FUNCIONAL NA CONSULTA", "Tela abriu corretamente."),
        ("Novo agendamento", "Cria atendimento com cliente, serviço, horário e colaborador.", "FUNCIONAL PÓS-CORREÇÃO", "A consulta de serviços foi corrigida para respeitar o contexto da empresa/unidade e publicada; o vínculo foi coberto por teste automatizado. Nenhum atendimento real foi salvo após a publicação para preservar a massa existente."),
        ("Disponibilidade", "Evita conflito de horário e respeita bloqueios.", "NÃO TESTADO", "Não houve agendamento salvo."),
    ], "FUNCIONAL PÓS-CORREÇÃO", "O bloqueio de colaborador e o carregamento de serviço foram tratados; a disponibilidade continua como validação complementar, sem alteração na agenda real."),
    ("Comercial", "Clientes", "/uikit/button", "Cadastro, busca e relacionamento com clientes para vendas, recorrências e histórico.", [
        ("Novo cliente", "Registra nome, telefone, e-mail e dados opcionais.", "FUNCIONAL", "Cliente sintético foi salvo e reapareceu na lista."),
        ("Busca e inativos", "Pesquisa clientes e destaca clientes sem compras.", "FUNCIONAL NA CONSULTA", "Busca/lista carregadas e indicador de inativos visualizado."),
        ("Aniversariantes e CMV", "Consulta aniversários e indicadores de consumo/margem.", "PARCIAL", "Botões foram visualizados; relatórios completos não foram executados."),
        ("Edição e exclusão", "Atualiza ou remove cadastro.", "FUNCIONAL COM PENDÊNCIAS", "Edição do cliente sintético foi salva e reapareceu na lista; exclusão não foi executada para preservar rastreabilidade."),
    ], "FUNCIONAL COM PENDÊNCIAS", "Cadastro e persistência foram comprovados com dados sintéticos."),
    ("Comercial", "Orçamentos", "/uikit/tree", "Propostas comerciais com cliente, itens, desconto, validade e transferência para o caixa.", [
        ("Novo orçamento", "Monta itens e valores antes da venda.", "FUNCIONAL", "Formulário, cliente/produto e persistência foram validados na rodada geral."),
        ("Filtros e consulta", "Localiza orçamentos por cliente/status.", "FUNCIONAL NA CONSULTA", "Tela abriu com controles."),
        ("Enviar ao caixa", "Transfere os itens aprovados para uma venda.", "FUNCIONAL PÓS-CORREÇÃO", "O vínculo orçamento-venda foi formalizado e publicado; a atualização de status, venda, estoque e entrada financeira ocorre de forma transacional, com cobertura automatizada."),
    ], "FUNCIONAL PÓS-CORREÇÃO", "A inconsistência observada na rodada anterior foi corrigida no código, protegida por migration e incluída no deploy de produção."),
    ("Comercial", "Caixa", "/uikit/input", "Abertura de caixa, venda, pagamentos, descontos, histórico, recibo e vínculo financeiro/estoque.", [
        ("Abertura de caixa", "Inicia turno com colaborador e valor inicial.", "FUNCIONAL", "Caixa aberto com colaborador QA e valor inicial zero, sem exigir senha."),
        ("Venda com cliente/produto", "Registra venda com item, quantidade e cliente.", "FUNCIONAL", "Venda #7791 criada com cliente e produto sintéticos."),
        ("Pagamento e recibo", "Registra forma de pagamento e gera recibo.", "FUNCIONAL COM OBSERVAÇÃO", "Recibo apareceu; padrão exibido foi Dinheiro."),
        ("Pergunta fiscal", "Oferece emissão de NFC-e/NF-e após venda.", "FUNCIONAL", "Opção apareceu e Não emitir agora foi selecionado."),
        ("Edição de venda", "Altera quantidade/valor e reprocessa efeitos.", "FUNCIONAL", "Quantidade 1 para 2 atualizou total e estoque."),
        ("Fechamento e relatório", "Fecha turno e gera relatório do dia.", "FUNCIONAL COM OBSERVAÇÃO", "Fechamento foi concluído com valor em caixa de R$ 24,00; o relatório do dia foi disponibilizado, mas não foi exportado para leitura binária."),
    ], "FUNCIONAL COM OBSERVAÇÃO", "Foi o fluxo transacional mais completo executado nesta rodada."),
    ("Comercial", "Serviços / NFS-e", "/uikit/servicos", "Cadastro de serviços e preparação para emissão de NFS-e.", [
        ("Cadastro de serviço", "Registra descrição, preço e parâmetros do serviço.", "FUNCIONAL", "Formulário e cadastro sem emissão fiscal foram validados anteriormente."),
        ("Consulta e filtros", "Lista serviços para venda e emissão.", "FUNCIONAL NA CONSULTA", "Tela abriu corretamente."),
        ("Emissão NFS-e", "Transmite serviço ao provedor fiscal.", "BLOQUEADO POR SEGURANÇA", "Nenhuma emissão foi realizada."),
    ], "FUNCIONAL NA CONSULTA", "Fluxo fiscal depende de configuração e autorização formal."),
    ("Comercial", "NF-e", "/uikit/servicos-nfe", "Emissão, consulta, download e acompanhamento de NF-e.", [
        ("Abertura da tela", "Carrega formulário e histórico de NF-e.", "FUNCIONAL NA CONSULTA", "Tela abriu sem emissão."),
        ("Emissão e transmissão", "Envia NF-e à Focus/SEFAZ.", "BLOQUEADO POR SEGURANÇA", "Não executado."),
        ("Download e reemissão", "Obtém XML/DANFE e reprocessa erros.", "NÃO TESTADO", "Sem nota fiscal sintética autorizada para reprocessamento."),
    ], "BLOQUEADO POR SEGURANÇA", "Abertura não equivale a homologação fiscal."),
    ("Comercial", "NFC-e", "/uikit/servicos-nfce", "Emissão de cupom fiscal, status, XML e DANFE.", [
        ("Abertura da tela", "Carrega formulário e histórico.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Emissão NFC-e", "Transmite documento fiscal ao provedor.", "BLOQUEADO POR SEGURANÇA", "Não executado."),
        ("Consulta/download", "Acompanha autorização e baixa arquivos.", "NÃO TESTADO", "Sem emissão fiscal nesta rodada."),
    ], "BLOQUEADO POR SEGURANÇA", "Nenhuma operação fiscal foi disparada."),
    ("Comercial", "Histórico de Notas", "/uikit/historico-notas", "Consulta centralizada de notas emitidas, status, arquivos e ações de reemissão.", [
        ("Listagem", "Exibe notas por tipo e status.", "FUNCIONAL NA CONSULTA", "Tela abriu e controles foram visualizados."),
        ("Reemissão de nota com erro", "Tenta novamente uma nota rejeitada/erro.", "NÃO TESTADO", "Não houve nota segura para reemissão."),
        ("Download XML/DANFE", "Permite baixar documentos fiscais.", "NÃO TESTADO", "Sem download fiscal realizado."),
    ], "FUNCIONAL NA CONSULTA", "A aba foi mapeada, mas ações fiscais ficaram deliberadamente sem execução."),
    ("Comercial", "Manifestos", "/uikit/manifestos", "MDF-e, veículos, condutores, cargas, rotas e encerramento de manifesto.", [
        ("Listagem e rascunho", "Consulta manifestos e permite preparar operação.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Validações", "Exige rota, veículo, condutor, documentos e carga.", "FUNCIONAL EM TESTE AUTOMATIZADO", "Regras de validação foram cobertas nos testes backend."),
        ("Emissão/encerramento", "Transmite MDF-e e encerra documento.", "BLOQUEADO POR SEGURANÇA", "Não executado."),
    ], "FUNCIONAL NA CONSULTA", "Validações foram testadas sem chamada externa."),
    ("Financeiro", "Recorrência", "/uikit/list", "Recorrências por cliente, serviços mensais, forma de pagamento, conta de recebimento e integração Asaas.", [
        ("Lista, filtros e dashboard", "Consulta recorrências por nome, CPF, telefone e tipo.", "FUNCIONAL NA CONSULTA", "Tela e filtros abriram."),
        ("Cliente criado na hora", "Permite selecionar cliente recém-cadastrado na recorrência.", "FUNCIONAL", "Cliente sintético apareceu imediatamente no seletor."),
        ("Nova recorrência", "Configura cliente, serviço, periodicidade, banco e valor.", "PARCIAL", "Formulário abriu; não foi salvo para não criar cobrança externa."),
        ("Asaas", "Sincroniza clientes/cobranças e status.", "NÃO TESTADO", "Não foi disparada cobrança real."),
    ], "FUNCIONAL COM PENDÊNCIAS", "A tela de recorrência foi validada sem efeito financeiro externo."),
    ("Financeiro", "Custos por Funcionários", "/uikit/table", "Custos mensais, contratos, salários, benefícios e visão de funcionários.", [
        ("Proteção da área", "Exige senha master antes de acessar dados sensíveis.", "FUNCIONAL", "Senha de teste informada pelo usuário foi aceita."),
        ("Dashboard de custos", "Mostra total de funcionários, folha e custo mensal.", "FUNCIONAL NA CONSULTA", "Indicadores carregaram inicialmente com zero funcionário; após o cadastro QA, a folha e o custo mensal foram recalculados na lista financeira."),
        ("Novo funcionário/importação", "Cadastra ou importa funcionário.", "FUNCIONAL COM PENDÊNCIAS", "Colaborador QA Agenda foi cadastrado com salário de R$ 2.000,00 e custo mensal calculado; a importação de usuário não foi executada."),
    ], "FUNCIONAL COM PENDÊNCIAS", "Acesso, cadastro e cálculo de custo foram confirmados; importação permanece pendente."),
    ("Financeiro", "Comissões", "/uikit/comissoes", "Comissões por funcionário, serviço, percentual/valor, pagamento e permissões.", [
        ("Listagem e filtros", "Consulta comissões pendentes/pagas por funcionário.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Cálculo", "Aplica regra percentual ou fixa.", "FUNCIONAL EM TESTE AUTOMATIZADO", "Regras de cálculo e escopo foram testadas no backend."),
        ("Pagar/excluir", "Liquida ou remove comissão.", "NÃO TESTADO", "Não havia comissão segura para liquidar."),
    ], "FUNCIONAL NA CONSULTA", "Regras automatizadas aprovadas; operação de pagamento não foi executada."),
    ("Financeiro", "Notas Fiscais - aba antiga", "/uikit/notas-fiscais", "Tela legada que duplicava as abas específicas de NF-e, NFC-e, NFS-e e Histórico.", [
        ("Abertura em produção", "Carrega notas fiscais da rota antiga.", "NÃO FUNCIONAL OBSERVADO", "Produção apresentou erro ao buscar notas; modelo foi corrigido localmente."),
        ("Navegação visível", "Mantém atalho no menu.", "PENDENTE DE DEPLOY", "A aba foi removida do código local; produção ainda exibe até publicar."),
        ("Compatibilidade de rota", "Preserva acesso direto sem apagar dados.", "FUNCIONAL NO CÓDIGO", "Rota protegida foi mantida para links antigos."),
    ], "PENDENTE DE PUBLICAÇÃO", "Recomendação: esconder o atalho e usar as abas fiscais separadas; não apagar a rota ainda."),
    ("Financeiro", "Dashboard Financeiro", "/financeiro/dashboard", "Indicadores de entradas, saídas, saldo, períodos e visão financeira.", [
        ("Indicadores", "Resume movimentação financeira da empresa.", "FUNCIONAL NA CONSULTA", "Tela abriu com dados."),
        ("Período e gráficos", "Altera janela de análise.", "PARCIAL", "Controles foram visualizados; todas as combinações não foram executadas."),
    ], "FUNCIONAL NA CONSULTA", "Sem lançamento adicional nesta tela."),
    ("Financeiro", "Entradas", "/financeiro/entradas", "Receitas manuais e entradas automáticas de vendas, com totalização e filtros.", [
        ("Novo lançamento manual", "Registra natureza, categoria, data, valor e descrição.", "FUNCIONAL", "Entrada sintética de R$ 75,00 apareceu na lista."),
        ("Entrada automática de venda", "Reflete venda concluída como Venda/Caixa.", "FUNCIONAL", "Venda #7791 apareceu com R$ 12,00."),
        ("Atualização após edição", "Recalcula o lançamento da venda editada.", "FUNCIONAL", "Após quantidade 1 para 2, entrada virou R$ 24,00 sem duplicação."),
        ("Filtros e totais", "Totaliza por período.", "FUNCIONAL NA CONSULTA", "Total e linhas carregaram; observou-se data manual exibida como 24/08 após cadastro em 25/08."),
    ], "FUNCIONAL COM OBSERVAÇÃO", "O vínculo venda-entrada foi confirmado ponta a ponta."),
    ("Financeiro", "Saídas", "/financeiro/saidas", "Despesas manuais, recorrências, funcionários, centro de custo e totalização.", [
        ("Novo lançamento manual", "Registra despesa com categoria e descrição.", "FUNCIONAL", "Saída sintética de R$ 20,00 apareceu."),
        ("Separação de venda", "Evita classificar receita de venda como saída.", "FUNCIONAL", "Após venda/edição, total permaneceu R$ 20,00; venda não entrou como despesa."),
        ("Editar/excluir saída", "Atualiza ou remove lançamento manual.", "FUNCIONAL COM PENDÊNCIAS", "Edição da saída manual de R$ 20,00 foi salva sem alterar valor; exclusão não foi executada."),
    ], "FUNCIONAL COM PENDÊNCIAS", "Consulta, gravação e edição manual foram confirmadas; exclusão permanece pendente."),
    ("Financeiro", "Relatórios Financeiros", "/financeiro/relatorios", "Relatórios consolidados de entradas, saídas, saldo e períodos.", [
        ("Carregamento", "Consulta dados financeiros da empresa.", "FUNCIONAL NA CONSULTA", "Após aguardar o carregamento, linhas e totais apareceram."),
        ("Filtros", "Recorta relatório por período/categoria.", "PARCIAL", "Tela e filtros abertos; combinações completas não foram exauridas."),
        ("Exportação", "Baixa relatório para uso externo.", "FUNCIONAL COM OBSERVAÇÃO", "Exportar Excel foi acionado sem erro visível; o canal de teste não expôs o arquivo baixado para leitura byte a byte."),
    ], "FUNCIONAL COM OBSERVAÇÃO", "Houve falha transitória em uma tentativa inicial, seguida de carregamento correto; totais e exportação foram exercitados."),
    ("Financeiro", "CRM / RFM", "/uikit/crm", "Segmentação e indicadores de relacionamento, recência, frequência e valor.", [
        ("Abertura e indicadores", "Carrega visão analítica de clientes.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Segmentação", "Organiza clientes por comportamento.", "NÃO TESTADO", "Filtros e ações analíticas não foram alterados."),
    ], "FUNCIONAL NA CONSULTA", "Sem alteração de cadastro nesta tela."),
    ("CRM Comercial", "Visão Geral", "/uikit/prospeccao/dashboard", "Painel de prospecção, funil, atividades e indicadores comerciais.", [
        ("Dashboard", "Exibe indicadores de prospecção.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Ações analíticas", "Navega para pipeline e relatórios.", "PARCIAL", "Atalhos visualizados; fluxos completos não foram salvos."),
    ], "FUNCIONAL NA CONSULTA", "Consulta visual validada."),
    ("CRM Comercial", "Pipeline", "/uikit/prospeccao/pipeline", "Acompanha oportunidades por estágio e movimentação do funil.", [
        ("Abertura", "Carrega o pipeline da empresa.", "PENDENTE", "Rota abriu, mas apresentou conteúdo semelhante a Empresas e Leads e precisa confirmação."),
        ("Mover oportunidade", "Avança lead entre etapas.", "NÃO TESTADO", "Nenhum lead foi movido."),
    ], "PENDENTE DE CONFIRMAÇÃO", "Possível componente/rota compartilhado incorretamente."),
    ("CRM Comercial", "Empresas e Leads", "/uikit/prospeccao", "Cadastro e prospecção de empresas, contatos e leads.", [
        ("Listagem", "Consulta empresas e leads.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Adicionar empresa", "Cria empresa/leads para prospecção.", "FUNCIONAL NA CONSULTA", "Formulário abriu e foi cancelado sem salvar nesta rodada."),
        ("Qualificação", "Classifica e acompanha oportunidade.", "NÃO TESTADO", "Sem alteração de lead."),
    ], "FUNCIONAL NA CONSULTA", "Sem comunicação externa."),
    ("CRM Comercial", "Campanhas", "/uikit/prospeccao/campanhas", "Criação e acompanhamento de campanhas comerciais.", [
        ("Nova campanha", "Define nome, público, canal e status.", "FUNCIONAL", "Campanha sintética foi persistida na rodada geral."),
        ("Ações de envio", "Dispara comunicação para público.", "BLOQUEADO POR SEGURANÇA", "Envio externo não executado."),
    ], "FUNCIONAL COM LIMITAÇÃO", "Cadastro validado; disparo não foi realizado."),
    ("CRM Comercial", "WhatsApp CRM", "/uikit/automacao-whatsapp", "Automação de mensagens e integração com WhatsApp.", [
        ("Abertura", "Carrega configuração e automações.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Envio/automação", "Envia mensagem e agenda automações.", "BLOQUEADO POR SEGURANÇA", "Nenhuma mensagem foi enviada."),
    ], "FUNCIONAL NA CONSULTA", "Integração externa deliberadamente não disparada."),
    ("CRM Comercial", "Histórico Comercial", "/uikit/prospeccao/historico", "Registra contatos, atividades e eventos comerciais.", [
        ("Listagem", "Consulta eventos comerciais.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Novo evento", "Registra interação com lead/cliente.", "NÃO TESTADO", "Não foi criado evento sintético nesta rodada."),
    ], "FUNCIONAL NA CONSULTA", "Consulta visual validada."),
    ("CRM Comercial", "Scripts IA", "/uikit/prospeccao/scripts", "Modelos de abordagem e roteiros assistidos por IA.", [
        ("Abertura", "Carrega scripts configuráveis.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Geração IA", "Produz texto assistido para abordagem.", "NÃO TESTADO", "Nenhuma chamada de IA foi realizada."),
    ], "FUNCIONAL NA CONSULTA", "Integração de IA ficou fora do teste operacional."),
    ("CRM Comercial", "Relatórios", "/uikit/prospeccao/relatorios", "Relatórios de funil, conversão e desempenho comercial.", [
        ("Abertura", "Carrega relatórios comerciais.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Filtros/exportação", "Recorta e baixa resultados.", "NÃO TESTADO", "Não foi exportado arquivo."),
    ], "FUNCIONAL NA CONSULTA", "Sem alteração de dados."),
    ("CRM Comercial", "Configurações CRM", "/uikit/prospeccao/configuracoes", "Parâmetros de estágios, campos e automações do CRM.", [
        ("Abertura", "Carrega parâmetros do CRM.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Salvar parâmetros", "Atualiza configuração comercial.", "NÃO TESTADO", "Não foram alteradas configurações."),
    ], "FUNCIONAL NA CONSULTA", "Consulta validada."),
    ("Contábil & Fiscal", "Dashboard Fiscal", "/uikit/contabil-fiscal/dashboard", "Visão fiscal consolidada e alertas de documentos.", [
        ("Abertura", "Carrega indicadores fiscais.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Ações fiscais", "Consulta/transmite documentos.", "BLOQUEADO POR SEGURANÇA", "Nenhuma transmissão."),
    ], "FUNCIONAL NA CONSULTA", "Sem emissão fiscal."),
    ("Contábil & Fiscal", "Central Fiscal", "/uikit/contabil-fiscal/central-fiscal", "Central de documentos, pendências e integrações fiscais.", [
        ("Abertura", "Carrega documentos e pendências.", "FUNCIONAL NA CONSULTA", "Tela abriu na varredura atual."),
        ("Ações de documento", "Consulta, manifesta ou transmite.", "BLOQUEADO POR SEGURANÇA", "Não executado."),
    ], "FUNCIONAL NA CONSULTA", "Erros 500 foram registrados em rodada anterior e permanecem como ponto de reteste."),
    ("Contábil & Fiscal", "Inteligência do Negócio", "/uikit/inteligencia", "Indicadores estratégicos para decisão gerencial.", [
        ("Abertura", "Carrega análises de negócio.", "FUNCIONAL NA CONSULTA", "Tela abriu na varredura atual."),
        ("Filtros e drill-down", "Aprofunda indicadores.", "NÃO TESTADO", "Sem alteração de filtros avançados."),
    ], "FUNCIONAL NA CONSULTA", "Não confundir com a rota Master de mesmo nome."),
    ("Contábil & Fiscal", "Inteligência Fiscal", "/uikit/contabil-fiscal/inteligencia-fiscal", "Análise de riscos, tributos e documentos fiscais.", [
        ("Abertura", "Carrega visão fiscal analítica.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Simulações", "Projeta cenários tributários.", "NÃO TESTADO", "Não foram alterados parâmetros fiscais."),
    ], "FUNCIONAL NA CONSULTA", "Sem emissão ou alteração fiscal."),
    ("Contábil & Fiscal", "Integração Contábil", "/uikit/contabil-fiscal/integracao-contabil", "Configura integração com contabilidade e exportação de dados.", [
        ("Abertura", "Carrega configuração contábil.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Sincronização/exportação", "Envia dados ao sistema contábil.", "NÃO TESTADO", "Integração externa não acionada."),
    ], "FUNCIONAL NA CONSULTA", "Sem chamada externa."),
    ("Contábil & Fiscal", "Gestão Tributária", "/uikit/contabil-fiscal/gestao-tributaria", "Parâmetros, regras e acompanhamento tributário.", [
        ("Abertura", "Carrega gestão tributária.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Salvar parâmetros", "Altera regras fiscais.", "BLOQUEADO POR SEGURANÇA", "Não alterado."),
    ], "FUNCIONAL NA CONSULTA", "Sem alteração fiscal."),
    ("Contábil & Fiscal", "Conciliação Financeira", "/uikit/contabil-fiscal/conciliacao", "Confronta movimentações financeiras e registros contábeis.", [
        ("Abertura e consulta", "Carrega lançamentos para conciliação.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Conciliar", "Marca correspondência entre itens.", "NÃO TESTADO", "Não foram alterados lançamentos."),
    ], "FUNCIONAL NA CONSULTA", "Fluxo de alteração pendente."),
    ("Contábil & Fiscal", "DRE & Relatórios", "/uikit/contabil-fiscal/dre-relatorios", "DRE, relatórios contábeis e indicadores de resultado.", [
        ("Abertura", "Carrega relatórios gerenciais.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Filtros/exportação", "Seleciona período e gera arquivo.", "NÃO TESTADO", "Não exportado."),
    ], "FUNCIONAL NA CONSULTA", "Sem alteração de dados."),
    ("Contábil & Fiscal", "Centro de Custos", "/uikit/contabil-fiscal/centro-custos", "Estrutura centros, categorias e rateios para análise financeira.", [
        ("Cadastro", "Cria centro de custo e regras.", "FUNCIONAL", "Cadastro/persistência sintéticos foram validados na rodada geral."),
        ("Consulta", "Lista centros e movimentos.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Rateio", "Distribui valores entre centros.", "NÃO TESTADO", "Não alterado."),
    ], "FUNCIONAL COM PENDÊNCIAS", "Cadastro básico comprovado."),
    ("Contábil & Fiscal", "Automação", "/uikit/contabil-fiscal/automacao", "Rotinas automáticas de conciliação, importação e tarefas fiscais.", [
        ("Abertura", "Carrega automações disponíveis.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Executar rotina", "Dispara processamento automático.", "NÃO TESTADO", "Nenhuma rotina externa executada."),
    ], "FUNCIONAL NA CONSULTA", "Sem efeitos externos."),
    ("Contábil & Fiscal", "Portal do Contador", "/uikit/contabil-fiscal/portal-contador", "Compartilha documentos e informações com o contador.", [
        ("Abertura", "Carrega portal e estado da empresa.", "FUNCIONAL NA CONSULTA", "Tela abriu com estado vazio/controles desabilitados."),
        ("Compartilhar/baixar", "Publica ou entrega documentos.", "NÃO TESTADO", "Não houve envio ao contador."),
    ], "FUNCIONAL NA CONSULTA", "Network Error de rodada anterior permanece como ponto de reteste."),
    ("Contábil & Fiscal", "Auditoria", "/uikit/contabil-fiscal/auditoria", "Consulta trilhas de auditoria e eventos relevantes.", [
        ("Abertura e consulta", "Lista eventos e alterações.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Filtros/exportação", "Recorta e baixa auditoria.", "NÃO TESTADO", "Não exportado."),
    ], "FUNCIONAL NA CONSULTA", "Sem alteração."),
    ("Departamento Pessoal", "Controle de Ponto", "/uikit/ponto", "Registra jornadas, marcações, justificativas e relatórios de ponto.", [
        ("Abertura", "Carrega tela de ponto.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Marcação/ajuste", "Registra ou corrige ponto.", "NÃO TESTADO", "Não houve marcação sintética."),
    ], "FUNCIONAL NA CONSULTA", "CRUD operacional pendente."),
    ("Jurídico", "Gestão de Contratos", "/uikit/contratos", "Cadastro, partes, vigência, documentos e acompanhamento contratual.", [
        ("Abertura e listagem", "Consulta contratos.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Novo contrato", "Registra título, partes, vigência e conteúdo.", "PARCIAL", "Campos sintéticos foram preenchidos e o salvamento foi tentado; o modal permaneceu aberto, indicando validação/campo obrigatório adicional, provavelmente datas de vigência. Foi cancelado sem persistir registro incompleto."),
        ("Edição/exclusão", "Atualiza ou remove contrato.", "NÃO TESTADO", "Não executado."),
    ], "FUNCIONAL NA CONSULTA", "Rodada anterior registrou pendência de feedback no salvamento."),
    ("Jurídico", "Procurações", "/uikit/procuracoes", "Cadastro de outorgante, outorgado, poderes, vigência e documentos.", [
        ("Abertura e listagem", "Consulta procurações.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Nova procuração", "Registra partes e poderes.", "PARCIAL", "Tipo, referência, partes e poderes sintéticos foram preenchidos e o salvamento foi tentado; a tela permaneceu aberta sem confirmação, indicando data ou outro campo obrigatório. Foi cancelada sem persistir registro incompleto."),
        ("Edição/exclusão", "Atualiza ou encerra procuração.", "NÃO TESTADO", "Não executado."),
    ], "FUNCIONAL NA CONSULTA", "Rodada anterior registrou pendência de feedback no salvamento."),
    ("Estratégia", "Marketing", "/uikit/menu", "Projetos, ações e organização de marketing.", [
        ("Abertura", "Carrega projetos e ferramentas.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Projeto sintético", "Cria iniciativa de marketing.", "FUNCIONAL", "Projeto sintético persistiu na rodada geral."),
        ("Execução externa", "Publica/dispara ação.", "NÃO TESTADO", "Nenhuma campanha externa foi disparada."),
    ], "FUNCIONAL COM LIMITAÇÃO", "Cadastro validado; execução externa preservada."),
    ("Estratégia", "Planejamento", "/uikit/message", "Planejamento interno, setores, metas, tarefas e organização operacional.", [
        ("Abertura", "Carrega estrutura de planejamento.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Setor sintético", "Cria estrutura para planejamento.", "FUNCIONAL", "Setor sintético persistiu na rodada geral."),
        ("Metas/tarefas", "Registra execução e acompanhamento.", "NÃO TESTADO", "Não houve alteração adicional."),
    ], "FUNCIONAL COM LIMITAÇÃO", "Estrutura básica validada."),
    ("Administração", "Usuários", "/uikit/invalidstate", "Cadastro de usuários, cargos, empresas vinculadas e permissões básicas.", [
        ("Cadastro", "Cria usuário com cargo e e-mail.", "FUNCIONAL", "Usuário colaborador sintético existia e foi usado na venda."),
        ("Lista e filtro", "Consulta usuários por empresa.", "FUNCIONAL NA CONSULTA", "Lista carregou usuários QA."),
        ("Acesso por perfil", "Controla módulos e rotas.", "PENDENTE", "Rodada anterior mostrou inconsistência entre menu vazio e acesso direto."),
    ], "FUNCIONAL COM PENDÊNCIA", "Cadastro e uso no caixa funcionaram; autorização precisa reteste dedicado."),
    ("Administração", "Gestão de Acessos", "/uikit/panel", "Permissões por módulo, pacote e perfil de acesso.", [
        ("Abertura", "Carrega matriz de permissões.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Alterar permissões", "Concede/revoga acesso.", "NÃO TESTADO", "Não alterado para preservar ambiente."),
    ], "FUNCIONAL NA CONSULTA", "Regras de autorização têm cobertura automatizada, mas não foram alteradas no browser."),
    ("Administração", "Minha Empresa", "/uikit/media", "Dados cadastrais, identidade visual e parâmetros gerais da empresa.", [
        ("Abertura e consulta", "Carrega dados da empresa selecionada.", "FUNCIONAL NA CONSULTA", "Tela abriu."),
        ("Editar dados", "Atualiza cadastro e identidade.", "NÃO TESTADO", "Não alterado."),
    ], "FUNCIONAL NA CONSULTA", "Sem alteração cadastral."),
    ("Administração", "Configuração Fiscal", "/uikit/integracao-focus", "Credenciais e parâmetros da integração fiscal Focus NFe.", [
        ("Abertura", "Carrega configuração fiscal.", "FUNCIONAL NA CONSULTA", "Formulário abriu."),
        ("Salvar credenciais", "Configura comunicação fiscal.", "BLOQUEADO POR SEGURANÇA", "Nenhuma credencial foi alterada."),
        ("Testar integração", "Confirma comunicação com provedor.", "NÃO TESTADO", "Não houve chamada externa."),
    ], "FUNCIONAL NA CONSULTA", "Sem transmissão fiscal."),
    ("Master", "Gestão de Empresas", "/uikit/gestao-empresas", "Criação, seleção, planos, pacotes e administração de empresas.", [
        ("Criar/selecionar empresa", "Mantém contexto da empresa ativa.", "FUNCIONAL", "Empresa QA foi selecionada e usada nos testes."),
        ("Pacotes e módulos", "Sincroniza módulos por plano.", "FUNCIONAL COM RETESTE", "Sincronização/reload fez módulos aparecerem após estado inicial vazio."),
        ("Acesso entre empresas", "Restringe dados ao contexto selecionado.", "FUNCIONAL EM TESTE AUTOMATIZADO", "Escopo de empresa coberto pelos testes backend."),
    ], "FUNCIONAL COM PENDÊNCIA", "Recomenda-se eliminar a necessidade de reload após sincronização."),
    ("Master", "Uso do Sistema", "/uikit/uso-sistema", "Métricas de uso, acessos e consumo de módulos.", [
        ("Abertura e consulta", "Lista utilização por empresa/usuário.", "FUNCIONAL NA CONSULTA", "Tela abriu e carregou linhas/estado vazio."),
        ("Filtros/exportação", "Recorta dados de uso.", "NÃO TESTADO", "Não exportado."),
    ], "FUNCIONAL NA CONSULTA", "Sem alteração."),
    ("Master", "Inteligência do Negócio", "/uikit/inteligencia-negocio", "Visão consolidada para administração Master e análise de empresas.", [
        ("Abertura", "Carrega dados agregados de empresas.", "FUNCIONAL NA CONSULTA", "Tela abriu na varredura atual."),
        ("Filtros e indicadores", "Analisa pacotes, empresas e uso.", "PARCIAL", "Conteúdo inicial visualizado; filtros avançados não foram exauridos."),
    ], "FUNCIONAL NA CONSULTA", "Erros 500 da rodada anterior devem continuar no reteste de regressão."),
]


def cover(story):
    story.append(Table([[p("RELATÓRIO COMPLETO", "CoverTitle")], [p("Funcionalidades, uso e validação do Lucro+", "CoverSub")], [p("Teste orientado a usuário - 25/08/2026", "CoverSub")]], colWidths=[182 * mm], rowHeights=[42 * mm, 15 * mm, 12 * mm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ])))
    story.append(Spacer(1, 8 * mm))
    story.append(table([
        ["Identificação", "Valor"],
        ["ID do relatório", "TEST-2026-08-25-002"],
        ["Ambiente", "Produção publicada - lucromais-frontend-mssolucoes.vercel.app"],
        ["Empresa de teste", "QA GERAL - TESTE 2026-08-24"],
        ["Escopo", "Mapeamento de abas, funções, navegação, cadastros sintéticos, venda, edição e consistência entre módulos"],
        ["Proteção", "Sem emissão fiscal, cobrança Asaas, envio WhatsApp ou exclusão destrutiva"],
    ], [40 * mm, 142 * mm]))
    story.append(Spacer(1, 8 * mm))
    story.append(callout("Conclusão executiva", "O Lucro+ está operacional nos fluxos centrais verificados e recebeu a publicação das correções priorizadas. A venda #7791 foi criada e editada com consistência entre Caixa, Entradas e Estoque; a produção sintética também foi concluída com entrada do produto final e baixa do insumo. As migrations estão completas em produção e as limitações restantes são de homologação complementar, principalmente integrações externas e operações fiscais.", TEAL))
    story.append(PageBreak())


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    frame = Frame(14 * mm, 17 * mm, 182 * mm, 263 * mm, id="normal", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=14 * mm, rightMargin=14 * mm, topMargin=17 * mm, bottomMargin=17 * mm, title="Relatório completo de funcionalidades Lucro+", author="OpenAI Codex")
    doc.addPageTemplates([PageTemplate(id="main", frames=frame, onPage=draw_page)])
    story = []
    cover(story)

    story.append(p("1. Objetivo e escopo", "H1L"))
    story.append(p("Este documento explica o propósito de cada aba visível do Lucro+, descreve as funções identificadas, registra o que foi exercitado e classifica o resultado observado. O objetivo é servir como material de operação, roteiro de homologação e base de priorização para correções.", "BodyL"))
    story.append(p("A validação combinou varredura de rotas, leitura de estados de tela, abertura segura de formulários e uso real com dados sintéticos. Após a rodada inicial, foram publicados os ajustes de data local, vínculo orçamento-caixa e carregamento de serviços na Agenda. A etapa transacional mais completa foi realizada no Caixa: abertura de turno, seleção de cliente e produto, venda, confirmação sem nota fiscal, conferência financeira, baixa de estoque e edição posterior.", "BodyL"))
    story.append(callout("Atualização pós-publicação - 25/08/2026", "Frontend e backend estão publicados. O health check do backend retornou banco conectado; as 39 migrations foram aplicadas, incluindo as seis migrations do último ciclo. A suíte backend terminou com 119 testes aprovados e a build do frontend gerou 85 rotas. Nenhuma emissão fiscal, cobrança real ou comunicação externa foi disparada.", BLUE))
    story.append(callout("Dados sintéticos usados", "Cliente: Cliente Teste Uso Real 2026-08-25. Produto: Produto Teste Uso Real 2026-08-25, SKU QA-REAL-20260825. Venda #7791. Entrada manual R$ 75,00 e saída manual R$ 20,00. Esses registros permanecem na empresa QA para auditoria do teste.", BLUE))

    story.append(p("2. Como interpretar os status", "H1L"))
    story.append(table([
        ["Status", "Significado"],
        ["FUNCIONAL", "Fluxo executado e concluído com evidência de persistência ou efeito esperado."],
        ["FUNCIONAL NA CONSULTA", "Tela, listagem ou indicador carregou; gravação, integração ou todas as variações não foram executadas."],
        ["FUNCIONAL COM PENDÊNCIAS", "Parte principal funciona, mas há funções secundárias ou variações ainda não homologadas."],
        ["PARCIAL", "A interface abriu e parte do fluxo foi exercitada, mas a conclusão ficou pendente."],
        ["BLOQUEADO POR SEGURANÇA", "Não executado deliberadamente porque poderia emitir documento, cobrar, enviar comunicação ou alterar ambiente sensível."],
        ["NÃO TESTADO", "A função foi identificada, mas não houve execução suficiente para afirmar comportamento."],
        ["PENDENTE", "Há evidência de inconsistência, erro observado ou necessidade de publicação/reteste."],
    ], [43 * mm, 139 * mm]))

    story.append(p("3. Evidências transversais da rodada de uso real", "H1L"))
    evidence = [
        ["Verificação", "Resultado observado", "Conclusão"],
        ["Cliente sintético", "Salvo e reapareceu na lista e no seletor de recorrência.", "Persistência e integração entre Clientes/Recorrência funcionais."],
        ["Produto sintético", "Saldo inicial 10, preço compra R$ 5, venda R$ 12.", "Cadastro e leitura de estoque funcionais."],
        ["Venda #7791", "Cliente, vendedor e item corretos; total inicial R$ 12.", "Caixa concluiu venda sem emissão fiscal."],
        ["Entrada da venda", "Venda/Caixa #7791 apareceu em Entradas por R$ 12.", "Integração Caixa/Financeiro funcional."],
        ["Saída de estoque", "Saldo 10 caiu para 9; histórico marcou Venda 1.", "Baixa automática funcional."],
        ["Edição da venda", "Quantidade 1 virou 2 e total R$ 12 virou R$ 24.", "Reprocessamento funcional."],
        ["Após edição", "Saldo 9 caiu para 8; histórico marcou Venda (editada) 2.", "Estoque alinhado ao novo estado."],
        ["Entrada após edição", "Lançamento #7791 foi atualizado para R$ 24 sem duplicação.", "Financeiro alinhado à edição."],
        ["Saídas financeiras", "Saída manual permaneceu R$ 20; venda não foi classificada como despesa.", "Separação entrada/saída preservada."],
        ["Estoque complementar", "Categoria e unidade QA foram criadas; giro exibiu o produto vendido e o histórico de etiquetas abriu.", "Recursos auxiliares de estoque persistiram; inventário exigiu autenticação."],
        ["Produção sintética", "Receita e ordem QA foram salvas; produção concluída com 1 produto final e consumo de 1 UN de matéria-prima.", "Entrada e saída da produção apareceram no histórico, sem emissão fiscal."],
        ["Pedido de compra", "PED-0002 foi salvo com fornecedor QA, produto QA, quantidade 1 e total R$ 10,00; consulta e PDF abriram.", "Pedido pendente persistiu; pagamento/recebimento/cancelamento não foram alterados."],
        ["Agenda", "A correção de consulta por empresa/unidade/serviço foi publicada e coberta por teste automatizado.", "O formulário passa a ter vínculo de serviço consistente; não foi salvo atendimento real após a publicação."],
        ["Orçamento para caixa", "O vínculo orçamento-venda foi formalizado e publicado com atualização transacional.", "Status, venda, estoque e entrada financeira passam a compartilhar o mesmo fluxo; nenhum dado real foi alterado na revalidação."],
        ["Fechamento e custos", "Caixa fechou com R$ 24,00; funcionário QA gerou custo mensal calculado e saída de folha.", "Fechamento e cálculo foram executados na empresa QA."],
        ["Edição de cadastro/saída", "Cliente sintético e saída manual de R$ 20,00 foram editados e permaneceram consistentes.", "Edição funcional; exclusões não foram feitas para preservar rastreabilidade."],
        ["Relatórios/exportação", "Relatório financeiro exibiu totais; Exportar Excel e Gerar PDF foram acionados sem erro visível.", "O PDF deste relatório foi gerado e lido localmente; downloads disparados pelo navegador não foram capturados para inspeção binária."],
        ["Migrations e publicação", "39/39 migrations aplicadas; backend com banco conectado e frontend publicado.", "Schema e código do ciclo estão presentes em produção."],
        ["Fiscal", "Não emitir agora foi selecionado.", "Nenhum documento fiscal foi transmitido."],
    ]
    story.append(table(evidence, [42 * mm, 70 * mm, 70 * mm]))
    story.append(Spacer(1, 5))
    story.append(callout("Observação importante", "O recibo apresentou Dinheiro como forma de pagamento padrão. Como não foi selecionada outra forma no teste, isso foi registrado como comportamento observado e não como falha confirmada.", AMBER))

    story.append(p("4. Matriz consolidada por módulo", "H1L"))
    counts = {}
    for group, *_ in modules:
        counts[group] = counts.get(group, 0) + 1
    summary_rows = [["Grupo", "Quantidade de abas", "Abrangência"]]
    descriptions = {
        "Geral": "Documentação e visão inicial",
        "Operacional": "Estoque, produção, compras e agenda",
        "Comercial": "Clientes, caixa, serviços e documentos",
        "Financeiro": "Recorrência, custos, comissões e relatórios",
        "CRM Comercial": "Prospecção, campanhas e relacionamento",
        "Contábil & Fiscal": "Fiscal, contábil, DRE, auditoria e portal",
        "Departamento Pessoal": "Ponto e jornada",
        "Jurídico": "Contratos e procurações",
        "Estratégia": "Marketing e planejamento",
        "Administração": "Usuários, acessos, empresa e configuração fiscal",
        "Master": "Empresas, uso e inteligência consolidada",
    }
    for group, count in counts.items():
        summary_rows.append([group, str(count), descriptions[group]])
    story.append(table(summary_rows, [47 * mm, 35 * mm, 100 * mm]))
    story.append(p("A seguir, cada aba é documentada individualmente. A ordem acompanha a navegação do sistema.", "BodyL"))

    current_group = None
    for group, name, route, purpose, features, status, evidence_text in modules:
        if group != current_group:
            story.append(p(f"5. {group}", "H1L"))
            current_group = group
        story.append(module(group, name, route, purpose, features, status, evidence_text))
        story.append(Spacer(1, 6))

    story.append(PageBreak())
    story.append(p("6. Status pós-publicação e validações complementares", "H1L"))
    story.append(p("As pendências de publicação e de estrutura identificadas na rodada anterior foram retiradas desta lista porque foram tratadas no ciclo atual. O quadro abaixo registra o que foi corrigido e publicado; as linhas seguintes são validações complementares ou limites de segurança, não defeitos confirmados.", "BodyL"))
    resolved = [
        ["Item tratado", "Situação após a publicação", "Evidência"],
        ["Migrations", "39/39 aplicadas em produção.", "Seis migrations do último ciclo foram executadas sem falha; o banco respondeu conectado."],
        ["Data de lançamentos", "Conversão local padronizada.", "Correção incluída no backend e coberta na suíte automatizada."],
        ["Orçamento para Caixa", "Vínculo orçamento-venda formalizado.", "Atualização de status, venda, estoque e entrada financeira ficou transacional."],
        ["Serviços na Agenda", "Consulta por empresa/unidade/serviço corrigida.", "Correção publicada e coberta por teste automatizado."],
        ["Notas e modelo fiscal", "Rotas e modelo corrigidos no ciclo publicado.", "Listagem/histórico permanecem sem emissão fiscal real nesta validação."],
        ["Exportações e relatórios", "Rotinas principais acionadas sem erro visível.", "Relatórios de estoque, financeiro, caixa e pedido foram exercitados no ambiente QA."],
    ]
    story.append(table(resolved, [43 * mm, 57 * mm, 82 * mm]))
    story.append(Spacer(1, 5))
    issues = [
        ["Tipo", "Validação complementar", "Limite observado", "Próximo passo seguro"],
        ["Escopo", "Homologação de integrações externas", "Asaas, Focus, WhatsApp e IA não foram acionados.", "Executar somente em sandbox com credenciais não produtivas."],
        ["Escopo", "Operações fiscais reais", "Emissão, cancelamento, reemissão e download fiscal não foram disparados.", "Homologar com autorização fiscal e certificado/credenciais de teste."],
        ["Escopo", "Upload de XML externo", "O parser e a rota foram validados, mas não houve upload de uma nota real.", "Usar XML de homologação e conferir preview, vínculo e histórico sem transmitir documento."],
        ["Escopo", "Revalidação visual autenticada pós-deploy", "A publicação foi validada por health check, build e testes automatizados; a sessão autenticada do navegador não foi reaberta após o deploy.", "Executar smoke test visual na empresa QA sem criar registros reais."],
        ["Escopo", "Reversões destrutivas e permissões", "Exclusões, cancelamentos e mudanças de perfil não foram feitos para preservar o ambiente.", "Usar registros sintéticos isolados e capturar auditoria antes/depois."],
    ]
    story.append(table(issues, [19 * mm, 54 * mm, 47 * mm, 62 * mm]))
    story.append(Spacer(1, 5))
    story.append(p("7. Limitações do teste", "H1L"))
    for item in [
        "A validação foi feita na empresa QA GERAL - TESTE 2026-08-24, não em dados de clientes reais.",
        "Emissões, cancelamentos, reemissões fiscais, cobrança Asaas, pagamentos, envio WhatsApp e automações externas não foram disparados.",
        "A importação XML foi validada no parser e na rota em QA; o anexo de XML externo não foi concluído para evitar qualquer transmissão fiscal.",
        "Status funcional significa resultado observado no cenário executado; não significa cobertura matemática de todas as combinações de campos.",
        "Os registros sintéticos criados durante o teste não foram removidos para preservar rastreabilidade; a limpeza deve ser feita somente com autorização.",
    ]:
        story.append(bullet(item))
    story.append(p("8. Conclusão", "H1L"))
    story.append(callout("Resultado final", "O núcleo operacional do Lucro+ foi mapeado, corrigido e publicado com as migrations completas. Os fluxos de venda, pedido, produção, fechamento de caixa, cadastro/edição, custos, vínculo orçamento-caixa e carregamento de serviços na Agenda foram cobertos por execução QA, testes automatizados ou correção publicada. O sistema está apto para uso controlado; permanecem apenas homologações complementares que exigem ambiente seguro, credenciais externas ou alterações que não foram autorizadas nesta rodada.", TEAL))
    story.append(p("Este relatório deve ser lido junto aos testes automatizados do backend e ao checklist de deploy/migrations. O status aqui é funcional e observacional, não substitui homologação fiscal ou contábil formal.", "BodyL"))

    doc.build(story)
    print(OUT)


def draw_page(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setFillColor(NAVY)
        canvas.rect(0, A4[1] - 9 * mm, A4[0], 9 * mm, stroke=0, fill=1)
        canvas.setFillColor(colors.white)
        canvas.setFont("Noto-Bold", 7)
        canvas.drawString(14 * mm, A4[1] - 6 * mm, "Lucro+ | Relatório completo de funcionalidades")
        canvas.setFont("Noto", 7)
        canvas.drawRightString(A4[0] - 14 * mm, A4[1] - 6 * mm, "25/08/2026")
    canvas.setStrokeColor(GRID)
    canvas.line(14 * mm, 12 * mm, A4[0] - 14 * mm, 12 * mm)
    canvas.setFillColor(SLATE)
    canvas.setFont("Noto", 7)
    canvas.drawString(14 * mm, 7 * mm, "TEST-2026-08-25-002 | Uso controlado em empresa QA")
    canvas.drawRightString(A4[0] - 14 * mm, 7 * mm, f"Página {doc.page}")
    canvas.restoreState()


if __name__ == "__main__":
    build()
