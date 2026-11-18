import axios from 'axios';
import FocusResellerService from './FocusResellerService.js';
import { montarManifestacaoFocus } from '../../utils/focusManifestacao.js';
import { Op } from 'sequelize';
import NotaFiscalFocus from '../../models/NotaFiscalFocus.js';

class FocusInvoicesService {
  async listarTodasPorVersao(
    client,
    endpoint,
    cnpj
  ) {
    let todas = [];
    let versao = null;
    let hasMore = true;
    let paginas = 0;
    const maxPaginas = 100;

    while (hasMore && paginas < maxPaginas) {
      const params = {
        cnpj
      };

      if (versao !== null) {
        params.versao = versao;
      }

      const response =
        await client.get(
          endpoint,
          {
            params
          }
        );

      const dados =
        Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.data)
            ? response.data.data
            : [];

      todas.push(...dados);
      paginas += 1;

      const cabecalhoVersao =
        response.headers[
          'x-max-version'
        ];
      const maxVersion =
        cabecalhoVersao === null ||
        cabecalhoVersao === undefined ||
        cabecalhoVersao === ''
          ? null
          : Number(cabecalhoVersao);

      if (
        dados.length < 100 ||
        maxVersion === null ||
        !Number.isFinite(maxVersion) ||
        (versao !== null && maxVersion <= versao)
      ) {
        hasMore = false;
      } else {
        versao = maxVersion;
      }
    }

    return todas;
  }

  async listarNFeRecebidas(
    empresaId,
    dataInicio,
    dataFim
  ) {
    try {
      const {
        client,
        cnpj
      } =
        await FocusResellerService.getEmpresaClient(
          empresaId
        );

      console.log(
        '📥 Listando TODAS NF-e recebidas:',
        cnpj
      );

      const nfes =
        await this.listarTodasPorVersao(
          client,
          '/v2/nfes_recebidas',
          cnpj
        );

      const nfesUnicas =
        this.deduplicarPorChave(
          nfes
        );

      const nfesFiltradas =
        this.filtrarPorDataArray(
          nfesUnicas,
          dataInicio,
          dataFim
        );

      const manifestacoes =
        await this.buscarManifestacoesPersistidas(
          empresaId,
          nfesUnicas
        );

      const nfesComManifestacao =
        nfesFiltradas.map((nota) => {
          const chave = this.obterChaveNota(nota);
          const persistida = chave
            ? manifestacoes.get(chave)
            : null;

          return persistida?.manifestacao_tipo
            ? {
                ...nota,
                manifestacao: persistida.manifestacao_tipo,
                data_manifestacao:
                  persistida.data_manifestacao
              }
            : nota;
        });

      return {
        success: true,
        data: nfesComManifestacao,
        meta: {
          totalCount:
            nfesUnicas.length
        }
      };
    } catch (error) {
      console.error(
        '❌ Erro ao listar NF-e:',
        error.response?.data ||
          error.message
      );

      return {
        success: false,
        error: {
          message:
            error.response?.data
              ?.mensagem ||
            error.message ||
            'Erro ao listar NF-e',

          code:
            error.response?.data
              ?.codigo ||
            'ERRO_LISTAR_NFE',

          details:
            error.response?.data
        }
      };
    }
  }

  async listarNFSeRecebidas(
    empresaId,
    dataInicio,
    dataFim
  ) {
    try {
      const {
        client,
        cnpj
      } =
        await FocusResellerService.getEmpresaClient(
          empresaId
        );

      console.log(
        '📥 Listando TODAS NFS-e recebidas:',
        cnpj
      );

      const nfses =
        await this.listarTodasPorVersao(
          client,
          '/v2/nfsens_recebidas',
          cnpj
        );

      const nfsesUnicas =
        this.deduplicarPorChave(
          nfses
        );

      const nfsesFiltradas =
        this.filtrarPorDataArray(
          nfsesUnicas,
          dataInicio,
          dataFim
        );

      return {
        success: true,
        data: nfsesFiltradas,
        meta: {
          totalCount:
            nfsesUnicas.length
        }
      };
    } catch (error) {
      console.error(
        '❌ Erro ao listar NFS-e:',
        error.response?.data ||
          error.message
      );

      return {
        success: false,
        error: {
          message:
            error.response?.data
              ?.mensagem ||
            error.message ||
            'Erro ao listar NFS-e',

          code:
            error.response?.data
              ?.codigo ||
            'ERRO_LISTAR_NFSE',

          details:
            error.response?.data
        }
      };
    }
  }

  deduplicarPorChave(
    lista
  ) {
    const mapa =
      new Map();

    for (const item of lista) {
      const chave =
        item.chave_nfe ||
        item.chave_nfse;

      if (!chave) {
        continue;
      }

      if (!mapa.has(chave)) {
        mapa.set(
          chave,
          item
        );
      }
    }

    return Array.from(
      mapa.values()
    );
  }

  filtrarPorDataArray(
    lista,
    dataInicio,
    dataFim
  ) {
    const inicio =
      dataInicio
        ? new Date(
            dataInicio
          )
        : null;

    const fim =
      dataFim
        ? new Date(
            dataFim
          )
        : null;

    if (!inicio && !fim) {
      return lista;
    }

    return lista.filter(
      item => {
        const dataEmissao =
          new Date(
            item.data_emissao
          );

        if (
          inicio &&
          dataEmissao <
            inicio
        ) {
          return false;
        }

        if (
          fim &&
          dataEmissao > fim
        ) {
          return false;
        }

        return true;
      }
    );
  }

  obterChaveNota(nota) {
    const chave =
      nota?.chave_nfe ||
      nota?.chave_acesso ||
      nota?.chave ||
      null;

    return this.normalizarChaveAcesso(chave);
  }

  normalizarChaveAcesso(chave) {
    if (chave === null || chave === undefined) {
      return null;
    }

    const valor = String(chave).trim();
    return valor || null;
  }

  obterChavesNota(nota) {
    const chave =
      nota?.chave_nfe ||
      nota?.chave_acesso ||
      nota?.chave ||
      null;

    if (chave === null || chave === undefined) {
      return [];
    }

    const original = String(chave);
    const normalizada = this.normalizarChaveAcesso(chave);

    return [...new Set(
      [original, normalizada].filter(Boolean)
    )];
  }

  async buscarManifestacoesPersistidas(empresaId, notas) {
    const chaves = notas
      .flatMap((nota) => this.obterChavesNota(nota));

    if (!chaves.length) {
      return new Map();
    }

    try {
      const registros = await NotaFiscalFocus.findAll({
        where: {
          empresa_id: empresaId,
          chave_acesso: {
            [Op.in]: chaves
          },
          manifestacao_tipo: {
            [Op.not]: null
          }
        },
        attributes: [
          'chave_acesso',
          'manifestacao_tipo',
          'data_manifestacao'
        ]
      });

      return new Map(
        registros.map((registro) => [
          this.normalizarChaveAcesso(
            registro.chave_acesso
          ),
          registro
        ])
      );
    } catch (error) {
      // A consulta da Focus não deve deixar de funcionar caso a migração
      // ainda não tenha sido aplicada em algum ambiente antigo.
      console.warn(
        '⚠️ Não foi possível carregar manifestações persistidas:',
        error.message
      );
      return new Map();
    }
  }

  async persistirManifestacao(
    empresaId,
    chaveAcesso,
    tipo
  ) {
    const chaveNormalizada =
      this.normalizarChaveAcesso(chaveAcesso);

    if (!chaveNormalizada) {
      return {
        persisted: false,
        error: 'Chave de acesso da NF-e não informada.'
      };
    }

    let ultimoErro;

    // A manifestação na Focus pode responder antes de uma conexão instável
    // com o banco. Uma segunda tentativa evita perder o status confirmado.
    for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
      try {
        const [registro, criado] =
          await NotaFiscalFocus.findOrCreate({
            where: {
              empresa_id: empresaId,
              chave_acesso: chaveNormalizada
            },
            defaults: {
              empresa_id: empresaId,
              chave_acesso: chaveNormalizada,
              manifestada: true,
              manifestacao_tipo: tipo,
              data_manifestacao: new Date()
            }
          });

        if (!criado) {
          await registro.update({
            manifestada: true,
            manifestacao_tipo: tipo,
            data_manifestacao: new Date()
          });
        }

        return {
          persisted: true,
          chave_acesso: chaveNormalizada,
          created: criado
        };
      } catch (error) {
        ultimoErro = error;
        if (tentativa < 2) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
    }

    console.error(
      '❌ Não foi possível persistir a manifestação após duas tentativas:',
      ultimoErro?.message || ultimoErro
    );

    return {
      persisted: false,
      error: ultimoErro?.message || 'Falha ao persistir manifestação.'
    };
  }

  async manifestarNFe(
    empresaId,
    chaveAcesso,
    tipo,
    justificativa
  ) {
    try {
      const payload = montarManifestacaoFocus(tipo, justificativa);

      const { client } =
        await FocusResellerService.getEmpresaClient(
          empresaId
        );

      console.log(
        '📝 Manifestando NF-e:',
        chaveAcesso,
        tipo
      );

      const response =
        await client.post(
          `/v2/nfes_recebidas/${chaveAcesso}/manifesto`,
          payload
        );

      const persistencia = await this.persistirManifestacao(
        empresaId,
        chaveAcesso,
        tipo
      );

      return {
        success: true,
        data:
          response.data,
        persistence: persistencia
      };
    } catch (error) {
      console.error(
        '❌ Erro na manifestação:',
        error.response?.data ||
          error.message
      );

      return {
        success: false,
        error: {
          message:
            error.response?.data
              ?.mensagem ||
            'Erro ao manifestar NF-e',

          code:
            error.response?.data
              ?.codigo ||
            'ERRO_MANIFESTACAO',

          details:
            error.response?.data
        }
      };
    }
  }

  async baixarXMLNFe(
    empresaId,
    chaveAcesso
  ) {
    const downloadDireto = await this.baixarArquivo(
      empresaId,
      `/v2/nfes_recebidas/${chaveAcesso}.xml`,
      `NFe_${chaveAcesso}.xml`,
      'application/xml',
      'xml'
    );

    // A Focus pode disponibilizar a NF-e recebida primeiro no endpoint JSON
    // e somente depois liberar o arquivo XML. Tente a consulta completa para
    // aproveitar a URL assinada quando o download direto ainda não existe.
    if (
      downloadDireto.success &&
      this.xmlBase64Valido(downloadDireto.data?.xml)
    ) {
      return downloadDireto;
    }

    const consultaCompleta = await this.consultarXMLNFeRecebida(
      empresaId,
      chaveAcesso
    );

    if (consultaCompleta.success) {
      return consultaCompleta;
    }

    // Uma resposta 2xx da Focus pode conter JSON, XML de evento ou uma
    // resposta intermediaria enquanto o XML completo ainda é processado.
    // Nunca devolva esse conteúdo como sucesso: o parser de estoque poderia
    // interpretá-lo como uma NF-e e gerar um erro enganoso.
    return downloadDireto.success
      ? consultaCompleta
      : downloadDireto;
  }

  xmlBase64Valido(valor) {
    if (!valor) return false;

    try {
      const conteudo = Buffer.from(valor, 'base64')
        .toString('utf8')
        .replace(/^\uFEFF/, '')
        .trim();
      return (
        conteudo.startsWith('<') &&
        /<(?:nfeProc|NFe)(?:\s|>)/i.test(conteudo) &&
        /<infNFe(?:\s|>)/i.test(conteudo)
      );
    } catch {
      return false;
    }
  }

  async consultarXMLNFeRecebida(empresaId, chaveAcesso) {
    try {
      const { client, cnpj } =
        await FocusResellerService.getEmpresaClient(empresaId);

      // A Focus documenta as duas formas de consulta individual. Algumas
      // contas retornam o XML completo apenas pela rota com a extensão .json,
      // então só conclua que o documento ainda não está disponível depois de
      // testar ambas.
      const endpoints = [
        `/v2/nfes_recebidas/${chaveAcesso}`,
        `/v2/nfes_recebidas/${chaveAcesso}.json`
      ];
      let ultimoErro;

      for (const endpoint of endpoints) {
        try {
          const resposta = await client.get(
            endpoint,
            {
              params: {
                cnpj,
                completa: '1'
              },
              headers: {
                Accept: 'application/json'
              }
            }
          );

          return await this.extrairXMLNFeRecebida(
            client,
            chaveAcesso,
            resposta.data || {}
          );
        } catch (error) {
          ultimoErro = error;
        }
      }

      throw ultimoErro || new Error(
        'A Focus ainda não disponibilizou o XML completo da NF-e'
      );
    } catch (error) {
      return {
        success: false,
        status: error.response?.status || 404,
        error: {
          message:
            error.response?.data?.mensagem ||
            error.response?.data?.message ||
            error.message ||
            'XML da NF-e não disponível',
          code: 'ERRO_XML_RECEBIDO'
        }
      };
    }
  }

  async extrairXMLNFeRecebida(client, chaveAcesso, dados) {
    const urlXml =
      dados.url_xml ||
      dados.xml_url ||
      dados.urlXml;

    if (urlXml) {
      const url = new URL(urlXml, client.defaults.baseURL).toString();
      const arquivo = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxRedirects: 5
      });

      const xml = Buffer.from(arquivo.data);
      const xmlBase64 = xml.toString('base64');
      if (!this.xmlBase64Valido(xmlBase64)) {
        throw new Error('A Focus ainda não disponibilizou o XML completo da NF-e');
      }

      return {
        success: true,
        data: {
          xml: xmlBase64,
          contentType: arquivo.headers?.['content-type'] || 'application/xml',
          filename: `NFe_${chaveAcesso}.xml`
        }
      };
    }

    const xmlInformado =
      dados.xml ||
      dados.xml_content ||
      dados.conteudo_xml;

    if (typeof xmlInformado === 'string') {
      const xml = xmlInformado.trim().startsWith('<')
        ? Buffer.from(xmlInformado)
        : Buffer.from(xmlInformado, 'base64');

      const xmlBase64 = xml.toString('base64');
      if (this.xmlBase64Valido(xmlBase64)) {
        return {
          success: true,
          data: {
            xml: xmlBase64,
            contentType: 'application/xml',
            filename: `NFe_${chaveAcesso}.xml`
          }
        };
      }
    }

    throw new Error(
      dados.mensagem ||
      dados.message ||
      'A Focus ainda não disponibilizou o XML completo da NF-e'
    );
  }

  async baixarXMLNFSe(
    empresaId,
    chaveAcesso
  ) {
    return this.baixarArquivo(
      empresaId,
      `/v2/nfsens_recebidas/${chaveAcesso}.xml`,
      `NFSe_${chaveAcesso}.xml`,
      'application/xml',
      'xml'
    );
  }

  async baixarPDFNFe(
    empresaId,
    chaveAcesso
  ) {
    return this.baixarArquivo(
      empresaId,
      `/v2/nfes_recebidas/${chaveAcesso}.pdf`,
      `NFe_${chaveAcesso}.pdf`,
      'application/pdf',
      'pdf'
    );
  }

  async baixarPDFNFSe(
    empresaId,
    chaveAcesso
  ) {
    return this.baixarArquivo(
      empresaId,
      `/v2/nfsens_recebidas/${chaveAcesso}.pdf`,
      `NFSe_${chaveAcesso}.pdf`,
      'application/pdf',
      'pdf'
    );
  }

  async baixarArquivo(
    empresaId,
    endpoint,
    filename,
    contentType,
    property
  ) {
    try {
      const { client } =
        await FocusResellerService.getEmpresaClient(
          empresaId
        );

      let response =
        await client.get(
          endpoint,
          {
            responseType:
              'arraybuffer',
            maxRedirects: 0,
            validateStatus: status =>
              (status >= 200 && status < 300) ||
              [301, 302, 303, 307, 308].includes(status)
          }
        );

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers?.location;
        if (!location) {
          throw new Error('A Focus não informou o endereço do arquivo');
        }

        const urlArquivo = new URL(
          location,
          client.defaults.baseURL
        ).toString();

        response = await axios.get(urlArquivo, {
          responseType: 'arraybuffer',
          timeout: 30000,
          maxRedirects: 5
        });
      }

      return {
        success: true,
        data: {
          [property]:
            Buffer.from(
              response.data
            ).toString(
              'base64'
            ),
          contentType:
            response.headers?.['content-type'] ||
            contentType,
          filename
        }
      };
    } catch (error) {
      let detalhe =
        error.response?.data;

      if (
        detalhe instanceof ArrayBuffer ||
        Buffer.isBuffer(detalhe)
      ) {
        const texto = Buffer.from(detalhe).toString('utf8');
        try {
          detalhe = JSON.parse(texto);
        } catch {
          detalhe = texto;
        }
      }

      const mensagem =
        detalhe?.mensagem ||
        detalhe?.message ||
        detalhe?.error?.message ||
        (typeof detalhe === 'string' ? detalhe : null) ||
        error.message ||
        'Erro ao baixar arquivo';

      console.error(
        '❌ Erro ao baixar arquivo:',
        mensagem
      );

      return {
        success: false,
        status:
          error.response?.status ||
          502,
        error: {
          message:
            mensagem,
          code:
            'ERRO_DOWNLOAD'
        }
      };
    }
  }
}

export default new FocusInvoicesService();
