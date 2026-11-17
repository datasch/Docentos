/**
 * Texto legal del contrato en cada idioma de la interfaz.
 *
 * El español es el texto ORIGINAL: es el que se firma y el que fija el sello de
 * integridad (SHA-256). Los demás idiomas son traducciones de cortesía para que
 * cada persona lea lo que acepta en su idioma; la interfaz avisa de que, si hay
 * alguna discrepancia, prevalece el original en español.
 *
 * Por eso `contractHash` se calcula siempre sobre el español, aunque se muestre
 * otra traducción: una firma registrada con ese sello sigue siendo válida sea
 * cual sea el idioma en que la persona lo leyó.
 */

import { createHash } from 'node:crypto';

export const CONTRACT_LANGUAGES = ['es', 'en', 'pt', 'fr', 'it'] as const;
export type ContractLanguage = (typeof CONTRACT_LANGUAGES)[number];
export const CANONICAL_CONTRACT_LANGUAGE: ContractLanguage = 'es';

export interface ContractTexts {
  /** Título del documento público (pie de página «Términos y privacidad»). */
  publicTitle: string;
  /** Título del contrato que se firma al registrarse. */
  signTitle: string;
  /** Cuerpo en Markdown sencillo: `# `, `### `, `**negrita**` y listas con `- `. */
  content: string;
}

/** «pt-BR», «EN» o un valor desconocido -> uno de los idiomas disponibles (por defecto, el original). */
export function resolveContractLanguage(raw: unknown): ContractLanguage {
  const base = String(Array.isArray(raw) ? raw[0] : raw ?? '').trim().toLowerCase().slice(0, 2);
  return (CONTRACT_LANGUAGES as readonly string[]).includes(base) ? (base as ContractLanguage) : CANONICAL_CONTRACT_LANGUAGE;
}

const ES_CONTENT = `# Contrato de Servicios Educativos y Tratamiento de Datos

**Plataforma DocentOS**

### 1. Objeto y Acceso a la Plataforma
El presente contrato regula el acceso y uso de los contenidos formativos, lecciones multimedia, mentorías y herramientas tecnológicas provistas por la plataforma.

### 2. Vigencia y Periodo de Acceso
- Fecha de Inicio: A partir del momento exacto del registro y firma electrónica de este acuerdo.
- Fecha de Fin de Vigencia: El acceso estándar a los materiales se otorga por un período renovable de 12 meses calendario.

### 3. Tratamiento y Periodo Prolongado de Retención de Datos
- Custodia de Datos y Progreso: En cumplimiento de las normativas de protección de datos personales y con la finalidad de acreditar certificaciones académicas emitidas, la plataforma conservará de forma segura su historial de usuario, calificaciones y progreso por un periodo prolongado de 24 meses tras la finalización del servicio.
- Derechos ARCO: El usuario podrá solicitar en cualquier momento la rectificación o supresión anticipada de sus datos de contacto conforme a los canales oficiales.

### 4. Propiedad Intelectual y Normas de Conducta
Los contenidos multimedia, guiones y recursos descargables son de uso personal e intransferible. Queda prohibida la redistribución o comercialización no autorizada.`;

export const CONTRACT_TEXTS: Record<ContractLanguage, ContractTexts> = {
  es: {
    publicTitle: 'Términos y Condiciones de la Plataforma & Política de Custodia',
    signTitle: 'Contrato de Servicios Educativos y Política de Retención de Datos',
    content: ES_CONTENT,
  },
  en: {
    publicTitle: 'Platform Terms and Conditions & Custody Policy',
    signTitle: 'Educational Services Agreement and Data Retention Policy',
    content: `# Educational Services and Data Processing Agreement

**DocentOS Platform**

### 1. Purpose and Access to the Platform
This agreement governs access to and use of the training content, multimedia lessons, mentorships and technology tools provided by the platform.

### 2. Term and Access Period
- Start Date: From the exact moment of registration and electronic signature of this agreement.
- End of Term: Standard access to the materials is granted for a renewable period of 12 calendar months.

### 3. Data Processing and Extended Retention Period
- Custody of Data and Progress: In compliance with personal data protection regulations and for the purpose of certifying the academic credentials issued, the platform will securely keep your user history, grades and progress for an extended period of 24 months after the end of the service.
- ARCO Rights (access, rectification, cancellation and opposition): The user may request at any time the rectification or early deletion of their contact data through the official channels.

### 4. Intellectual Property and Rules of Conduct
The multimedia content, scripts and downloadable resources are for personal, non-transferable use. Unauthorized redistribution or commercialization is prohibited.`,
  },
  pt: {
    publicTitle: 'Termos e Condições da Plataforma e Política de Custódia',
    signTitle: 'Contrato de Serviços Educacionais e Política de Retenção de Dados',
    content: `# Contrato de Serviços Educacionais e Tratamento de Dados

**Plataforma DocentOS**

### 1. Objeto e Acesso à Plataforma
O presente contrato regula o acesso e o uso dos conteúdos formativos, aulas multimídia, mentorias e ferramentas tecnológicas fornecidos pela plataforma.

### 2. Vigência e Período de Acesso
- Data de Início: A partir do momento exato do registro e da assinatura eletrônica deste acordo.
- Data de Término da Vigência: O acesso padrão aos materiais é concedido por um período renovável de 12 meses corridos.

### 3. Tratamento e Período Prolongado de Retenção de Dados
- Custódia de Dados e Progresso: Em cumprimento das normas de proteção de dados pessoais e com a finalidade de comprovar as certificações acadêmicas emitidas, a plataforma conservará de forma segura o seu histórico de usuário, notas e progresso por um período prolongado de 24 meses após o término do serviço.
- Direitos ARCO (acesso, retificação, cancelamento e oposição): O usuário poderá solicitar a qualquer momento a retificação ou a exclusão antecipada de seus dados de contato pelos canais oficiais.

### 4. Propriedade Intelectual e Normas de Conduta
Os conteúdos multimídia, roteiros e recursos para download são de uso pessoal e intransferível. Fica proibida a redistribuição ou comercialização não autorizada.`,
  },
  fr: {
    publicTitle: 'Conditions générales de la plateforme et politique de conservation',
    signTitle: 'Contrat de services éducatifs et politique de conservation des données',
    content: `# Contrat de services éducatifs et de traitement des données

**Plateforme DocentOS**

### 1. Objet et accès à la plateforme
Le présent contrat régit l'accès et l'utilisation des contenus de formation, des leçons multimédias, des mentorats et des outils technologiques fournis par la plateforme.

### 2. Durée et période d'accès
- Date de début : À compter du moment exact de l'inscription et de la signature électronique du présent accord.
- Date de fin de validité : L'accès standard aux contenus est accordé pour une période renouvelable de 12 mois calendaires.

### 3. Traitement et période prolongée de conservation des données
- Conservation des données et de la progression : Conformément à la réglementation sur la protection des données personnelles et afin de justifier les certifications académiques délivrées, la plateforme conservera de manière sécurisée votre historique d'utilisateur, vos notes et votre progression pendant une période prolongée de 24 mois après la fin du service.
- Droits ARCO (accès, rectification, suppression et opposition) : L'utilisateur pourra demander à tout moment la rectification ou la suppression anticipée de ses données de contact par les canaux officiels.

### 4. Propriété intellectuelle et règles de conduite
Les contenus multimédias, scripts et ressources téléchargeables sont à usage personnel et non transférable. Toute redistribution ou commercialisation non autorisée est interdite.`,
  },
  it: {
    publicTitle: 'Termini e Condizioni della piattaforma e Politica di custodia',
    signTitle: 'Contratto di servizi educativi e politica di conservazione dei dati',
    content: `# Contratto di servizi educativi e trattamento dei dati

**Piattaforma DocentOS**

### 1. Oggetto e accesso alla piattaforma
Il presente contratto disciplina l'accesso e l'uso dei contenuti formativi, delle lezioni multimediali, dei mentoring e degli strumenti tecnologici forniti dalla piattaforma.

### 2. Durata e periodo di accesso
- Data di inizio: Dal momento esatto della registrazione e della firma elettronica del presente accordo.
- Data di fine validità: L'accesso standard ai materiali è concesso per un periodo rinnovabile di 12 mesi di calendario.

### 3. Trattamento e periodo prolungato di conservazione dei dati
- Custodia dei dati e dei progressi: In conformità alle normative sulla protezione dei dati personali e al fine di attestare le certificazioni accademiche rilasciate, la piattaforma conserverà in modo sicuro la cronologia utente, i voti e i progressi per un periodo prolungato di 24 mesi dopo la fine del servizio.
- Diritti ARCO (accesso, rettifica, cancellazione e opposizione): L'utente potrà richiedere in qualsiasi momento la rettifica o la cancellazione anticipata dei propri dati di contatto attraverso i canali ufficiali.

### 4. Proprietà intellettuale e norme di condotta
I contenuti multimediali, i copioni e le risorse scaricabili sono ad uso personale e non trasferibile. È vietata la ridistribuzione o commercializzazione non autorizzata.`,
  },
};

export function getContractTexts(language: ContractLanguage): ContractTexts {
  return CONTRACT_TEXTS[language] ?? CONTRACT_TEXTS[CANONICAL_CONTRACT_LANGUAGE];
}

/** Sello de integridad (SHA-256) del texto ORIGINAL en español: es el que se registra en cada firma. */
export const CANONICAL_CONTRACT_HASH = createHash('sha256').update(CONTRACT_TEXTS[CANONICAL_CONTRACT_LANGUAGE].content).digest('hex');
