/**
 * Generador de Certificados Oficiales en Canvas de Alto Rendimiento
 * Academia Giantucchi Open Source
 *
 * Soporta:
 * - Fondo blanco o negro configurable (backgroundColor)
 * - Logo institucional (institutionLogo)
 * - Firma digitalizada principal (signatureImage)
 * - Firma universitaria/institucional OPCIONAL (enableUniversitySignature, universitySignatureImage)
 * - Color primario personalizable
 */

import { pluginManager } from './PluginManager';

export interface CertificateData {
  studentName: string;
  courseTitle: string;
  institutionName?: string;
  // Firma 1 (Principal): Giantucchi
  signatoryTitle?: string;
  signatureImage?: string;
  // Firma 2 (Opcional - Izquierda): Universidades / Institutos
  enableUniversitySignature?: boolean;
  universitySignatoryTitle?: string;
  universitySignatureImage?: string;
  institutionLogo?: string;
  primaryColor?: string;
  backgroundColor?: 'dark' | 'white' | 'black';
  badgeText?: string;
  dateStr?: string;
  certificateId?: string;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
    return img.width > 0 && img.height > 0 ? img : null;
  } catch {
    return null;
  }
}

export async function generateCertificatePNG(data: CertificateData): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1130; // Aspect ratio ~ 1.41 (A4 horizontal)

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const certPluginConfig = pluginManager.getPlugin('pdf-certificates')?.config || {};

  const primaryColor = data.primaryColor || certPluginConfig.primaryColor || '#06b6d4';
  const institution = data.institutionName || certPluginConfig.institutionName || 'Academia Giantucchi';
  const giantucchiSignatory = data.signatoryTitle || certPluginConfig.signatoryTitle || 'Prof. Giancarlo Giantucchi - Mentor Director & Evaluador';
  const giantucchiSignatureSrc = data.signatureImage || certPluginConfig.signatureImage || certPluginConfig.signature;

  // Determinamos si la firma de la universidad está habilitada
  const isUnivSignatureEnabled = data.enableUniversitySignature !== undefined
    ? Boolean(data.enableUniversitySignature)
    : certPluginConfig.enableUniversitySignature !== undefined
      ? Boolean(certPluginConfig.enableUniversitySignature)
      : Boolean(data.universitySignatureImage || certPluginConfig.universitySignatureImage);

  const univSignatory = data.universitySignatoryTitle || certPluginConfig.universitySignatoryTitle || 'Dirección Académica - Universidad / Instituto';
  const univSignatureSrc = data.universitySignatureImage || certPluginConfig.universitySignatureImage;
  const logoSrc = data.institutionLogo || certPluginConfig.institutionLogo || '/logo.avif';
  const badge = data.badgeText || certPluginConfig.badgeText || 'CERTIFICADO DE EXCELENCIA TÉCNICA';
  const bgMode = data.backgroundColor || certPluginConfig.backgroundColor || 'dark';
  const dateStr = data.dateStr || new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const certId = data.certificateId || `DOCENTOS-CERT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  // ─── Paleta según el fondo ───────────────────────────────────────────────────
  const isLight = bgMode === 'white';
  const isWhite = bgMode === 'white';

  const bgColor = isWhite ? '#ffffff' : '#0a0a12';
  const mainTextColor = isWhite ? '#111827' : '#ffffff';
  const subTextColor = isWhite ? '#374151' : '#cbd5e1';
  const mutedColor = isWhite ? '#6b7280' : '#94a3b8';
  const idColor = isWhite ? '#9ca3af' : '#64748b';
  const borderLineColor = isWhite ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)';
  const dividerColor = isWhite ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)';
  const signLineColor = isWhite ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)';
  const sealBgColor = isWhite ? 'rgba(234, 179, 8, 0.12)' : 'rgba(234, 179, 8, 0.15)';

  // 1. Fondo
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Marco Exterior con Gradiente de Borde
  const strokeGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  strokeGrad.addColorStop(0, primaryColor);
  strokeGrad.addColorStop(0.5, '#a855f7');
  strokeGrad.addColorStop(1, '#eab308');

  ctx.lineWidth = 16;
  ctx.strokeStyle = strokeGrad;
  ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

  // Marco Interior Fino
  ctx.lineWidth = 2;
  ctx.strokeStyle = borderLineColor;
  ctx.strokeRect(60, 60, canvas.width - 120, canvas.height - 120);

  // 3. Adornos de Esquina
  const drawCorner = (x: number, y: number) => {
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  };
  drawCorner(75, 75);
  drawCorner(canvas.width - 75, 75);
  drawCorner(75, canvas.height - 75);
  drawCorner(canvas.width - 75, canvas.height - 75);

  // 4. Logo Institucional (si existe o por defecto Giantucchi)
  let headerTopY = 160;
  const effectiveLogoSrc = logoSrc || '/logo.avif';
  const logoImg = await loadImage(effectiveLogoSrc);
  if (logoImg) {
    const maxLogoW = 220;
    const maxLogoH = 85;
    const aspect = logoImg.width / logoImg.height;
    let lw = maxLogoW;
    let lh = maxLogoW / aspect;
    if (lh > maxLogoH) { lh = maxLogoH; lw = lh * aspect; }
    const lx = canvas.width / 2 - lw / 2;
    const ly = 95;
    ctx.drawImage(logoImg, lx, ly, lw, lh);
    headerTopY = ly + lh + 35;
  } else if (!logoSrc || logoSrc === '/logo.avif') {
    // Insignia espectral Giantucchi vectorial (fallback cuando no se carga archivo de imagen)
    const badgeW = 68;
    const badgeH = 68;
    const bx = canvas.width / 2 - badgeW / 2;
    const by = 92;
    const gGrad = ctx.createLinearGradient(bx, by, bx + badgeW, by + badgeH);
    gGrad.addColorStop(0, '#06b6d4');
    gGrad.addColorStop(0.2, '#3b82f6');
    gGrad.addColorStop(0.4, '#a855f7');
    gGrad.addColorStop(0.6, '#ec4899');
    gGrad.addColorStop(0.8, '#f97316');
    gGrad.addColorStop(1, '#eab308');

    ctx.fillStyle = gGrad;
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(bx, by, badgeW, badgeH, 16);
    } else {
      ctx.rect(bx, by, badgeW, badgeH);
    }
    ctx.fill();

    ctx.fillStyle = isWhite ? '#ffffff' : '#0a0a0f';
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(bx + 3, by + 3, badgeW - 6, badgeH - 6, 13);
    } else {
      ctx.rect(bx + 3, by + 3, badgeW - 6, badgeH - 6);
    }
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = primaryColor;
    ctx.fillText('G', canvas.width / 2, by + badgeH / 2);
    ctx.textBaseline = 'alphabetic';

    headerTopY = by + badgeH + 35;
  }

  // 5. Encabezado de la Institución
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = primaryColor;
  ctx.fillText(institution.toUpperCase(), canvas.width / 2, headerTopY);

  // Insignia / Badge
  ctx.font = '800 20px sans-serif';
  ctx.fillStyle = '#a855f7';
  ctx.fillText(`★ ${badge} ★`, canvas.width / 2, headerTopY + 50);

  // Línea divisoria
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 200, headerTopY + 80);
  ctx.lineTo(canvas.width / 2 + 200, headerTopY + 80);
  ctx.strokeStyle = dividerColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 6. Texto Principal
  ctx.font = '300 28px sans-serif';
  ctx.fillStyle = subTextColor;
  ctx.fillText('Se otorga el presente reconocimiento oficial a:', canvas.width / 2, headerTopY + 160);

  // Nombre del Estudiante
  ctx.font = 'bold 64px serif';
  ctx.fillStyle = mainTextColor;
  ctx.fillText(data.studentName, canvas.width / 2, headerTopY + 250);

  // Subtexto
  ctx.font = '300 24px sans-serif';
  ctx.fillStyle = subTextColor;
  ctx.fillText('Por haber completado satisfactoriamente el programa de formación:', canvas.width / 2, headerTopY + 325);

  // Título del Curso
  ctx.font = 'bold 40px sans-serif';
  const courseGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  courseGrad.addColorStop(0.3, primaryColor);
  courseGrad.addColorStop(0.7, '#a855f7');
  ctx.fillStyle = courseGrad;

  const rawTitle = `"${data.courseTitle}"`;
  const wrappedLines = wrapText(ctx, rawTitle, 1200);
  const startY = headerTopY + 395;
  const lineHeight = 52;
  wrappedLines.forEach((line, idx) => {
    ctx.fillText(line, canvas.width / 2, startY + idx * lineHeight);
  });

  // 7. Sello Dorado Oficial de Alta Seguridad (Premium Notary Rosette Seal)
  const sealY = startY + wrappedLines.length * lineHeight + 70;
  const sealR = 56;

  ctx.save();
  ctx.translate(canvas.width / 2, sealY);

  // 7.1 Resplandor ambiental de fondo
  const glowGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, sealR + 25);
  glowGrad.addColorStop(0, isWhite ? 'rgba(234, 179, 8, 0.12)' : 'rgba(234, 179, 8, 0.16)');
  glowGrad.addColorStop(0.6, isWhite ? 'rgba(6, 182, 212, 0.05)' : 'rgba(168, 85, 247, 0.08)');
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(0, 0, sealR + 25, 0, Math.PI * 2);
  ctx.fill();

  // 7.2 Gradiente Metálico Dorado Principal
  const goldGrad = ctx.createLinearGradient(-sealR, -sealR, sealR, sealR);
  goldGrad.addColorStop(0, '#fef08a');   // Oro claro brillante
  goldGrad.addColorStop(0.25, '#eab308'); // Oro cálido
  goldGrad.addColorStop(0.5, '#ca8a04');  // Oro profundo
  goldGrad.addColorStop(0.75, '#fef08a'); // Reflejo brillante
  goldGrad.addColorStop(1, '#a16207');   // Sombra metálica

  // 7.3 Roseta / Festón Exterior Festoneado (32 ondas festoneadas de seguridad)
  ctx.beginPath();
  const numPetals = 32;
  for (let theta = 0; theta <= Math.PI * 2; theta += 0.02) {
    const r = sealR + 3.5 * Math.sin(numPetals * theta);
    const px = r * Math.cos(theta);
    const py = r * Math.sin(theta);
    if (theta === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = isWhite ? '#ffffff' : '#0c0c16';
  ctx.fill();
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 7.4 Anillo Interior con Micro-Gradiente Espectral
  const specGrad = ctx.createLinearGradient(-sealR, 0, sealR, 0);
  specGrad.addColorStop(0, '#06b6d4');
  specGrad.addColorStop(0.5, '#a855f7');
  specGrad.addColorStop(1, '#eab308');

  ctx.beginPath();
  ctx.arc(0, 0, sealR - 5, 0, Math.PI * 2);
  ctx.strokeStyle = specGrad;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 7.5 Cuentas Notariales Perimetrales (Puntos de seguridad grabados)
  const numBeads = 36;
  ctx.fillStyle = goldGrad;
  for (let i = 0; i < numBeads; i++) {
    const angle = (i * 2 * Math.PI) / numBeads;
    const bx = (sealR - 9) * Math.cos(angle);
    const by = (sealR - 9) * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(bx, by, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 7.6 Micro-Líneas Guilloche de Seguridad de Fondo
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, sealR - 12, 0, Math.PI * 2);
  ctx.clip();

  ctx.lineWidth = 0.8;
  for (let k = 0; k < 2; k++) {
    ctx.beginPath();
    const loops = 10 + k * 4;
    const amp = 4 + k * 2;
    for (let t = 0; t <= Math.PI * 2; t += 0.04) {
      const rad = 28 + amp * Math.sin(loops * t);
      const gx = rad * Math.cos(t);
      const gy = rad * Math.sin(t);
      if (t === 0) ctx.moveTo(gx, gy);
      else ctx.lineTo(gx, gy);
    }
    ctx.closePath();
    ctx.strokeStyle = k === 0 ? 'rgba(6, 182, 212, 0.3)' : 'rgba(234, 179, 8, 0.3)';
    ctx.stroke();
  }
  ctx.restore();

  // 7.7 Placa Central Biselada
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fillStyle = isWhite ? 'rgba(255, 255, 255, 0.95)' : 'rgba(18, 18, 30, 0.92)';
  ctx.fill();
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 7.8 Tipografía y Elementos de Autenticidad
  // Estrellas superiores
  ctx.textAlign = 'center';
  ctx.font = 'bold 9px sans-serif';
  ctx.fillStyle = '#eab308';
  ctx.fillText('★  ★  ★', 0, -18);

  // Texto VERIFIED con relieve dorado
  ctx.font = '900 17px sans-serif';
  ctx.fillStyle = goldGrad;
  ctx.letterSpacing = '1px';
  ctx.fillText('VERIFIED', 0, 0);
  ctx.letterSpacing = '0px';

  // Línea sutil bajo VERIFIED
  ctx.beginPath();
  ctx.moveTo(-22, 5);
  ctx.lineTo(22, 5);
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Leyenda Inferior
  ctx.font = 'bold 7.5px sans-serif';
  ctx.fillStyle = isWhite ? '#0284c7' : '#06b6d4';
  ctx.fillText('OFFICIAL CERTIFIED', 0, 16);

  ctx.font = '6.5px sans-serif';
  ctx.fillStyle = isWhite ? '#64748b' : '#94a3b8';
  ctx.fillText('DOCENTOS ACADEMY', 0, 25);

  ctx.restore();

  // 8. PIE DE PÁGINA: FIRMAS Y METADATOS (CONDICIONAL: DOBLE FIRMA vs FIRMA ÚNICA)
  const footerY = canvas.height - 145;
  const lineY = footerY + 15;

  const defaultRightSignatoryName = giantucchiSignatory
    .replace(/^(Prof\.|Dr\.|Ing\.|Lic\.)\s+/i, '')
    .split('-')[0]
    .trim() || 'Giancarlo Giantucchi';

  if (isUnivSignatureEnabled) {
    // ═══════════════════════════════════════════════════════════════════════════
    // MODO DOBLE FIRMA: Universidad (Izq) + Metadatos (Centro) + Giantucchi (Der)
    // ═══════════════════════════════════════════════════════════════════════════
    const leftCenterX = 310;
    const leftLineStart = 140;
    const leftLineEnd = 480;

    if (univSignatureSrc) {
      const uSigImg = await loadImage(univSignatureSrc);
      if (uSigImg) {
        const maxWidth = 320;
        const maxHeight = 100;
        const aspect = uSigImg.width / uSigImg.height;
        let w = maxWidth;
        let h = maxWidth / aspect;
        if (h > maxHeight) { h = maxHeight; w = h * aspect; }
        // Firma casi al ras de la línea
        ctx.drawImage(uSigImg, leftCenterX - w / 2, lineY - h + 6, w, h);
      } else {
        ctx.textAlign = 'center';
        ctx.font = 'italic 30px "Brush Script MT", "Segoe Script", cursive, serif';
        ctx.fillStyle = isWhite ? '#0284c7' : '#06b6d4';
        ctx.fillText(univSignatory.split('-')[0].trim() || 'Firma Institucional', leftCenterX, lineY - 4);
      }
    } else {
      ctx.textAlign = 'center';
      ctx.font = 'italic 30px "Brush Script MT", "Segoe Script", cursive, serif';
      ctx.fillStyle = isWhite ? '#0284c7' : '#06b6d4';
      ctx.fillText(univSignatory.split('-')[0].trim() || 'Firma Decanato / Rectorado', leftCenterX, lineY - 4);
    }

    // Línea de firma izquierda
    ctx.beginPath();
    ctx.moveTo(leftLineStart, lineY);
    ctx.lineTo(leftLineEnd, lineY);
    ctx.strokeStyle = signLineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Nombre y cargo institucional izquierdo
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = mainTextColor;
    ctx.fillText(univSignatory, leftCenterX, lineY + 26);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = mutedColor;
    ctx.fillText('Universidad / Instituto Acreditador', leftCenterX, lineY + 46);

    // Metadatos Centrales
    ctx.textAlign = 'center';
    ctx.font = '15px sans-serif';
    ctx.fillStyle = mutedColor;
    ctx.fillText(`Fecha de Emisión: ${dateStr}`, canvas.width / 2, lineY + 5);

    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = idColor;
    ctx.fillText(`ID: ${certId}`, canvas.width / 2, lineY + 26);

    ctx.font = '11px sans-serif';
    ctx.fillStyle = isWhite ? '#9ca3af' : '#64748b';
    ctx.fillText('Acreditación y Certificación Conjunta Oficial', canvas.width / 2, lineY + 46);

    // Firma Derecha (Giantucchi)
    const rightCenterX = canvas.width - 310;
    const rightLineStart = canvas.width - 480;
    const rightLineEnd = canvas.width - 140;

    if (giantucchiSignatureSrc) {
      const gSigImg = await loadImage(giantucchiSignatureSrc);
      if (gSigImg) {
        const maxWidth = 320;
        const maxHeight = 100;
        const aspect = gSigImg.width / gSigImg.height;
        let w = maxWidth;
        let h = maxWidth / aspect;
        if (h > maxHeight) { h = maxHeight; w = h * aspect; }
        // Firma casi al ras de la línea
        ctx.drawImage(gSigImg, rightCenterX - w / 2, lineY - h + 6, w, h);
      } else {
        ctx.textAlign = 'center';
        ctx.font = 'italic 32px "Brush Script MT", "Segoe Script", cursive, serif';
        ctx.fillStyle = isWhite ? '#db2777' : '#ec4899';
        ctx.fillText(defaultRightSignatoryName, rightCenterX, lineY - 4);
      }
    } else {
      ctx.textAlign = 'center';
      ctx.font = 'italic 32px "Brush Script MT", "Segoe Script", cursive, serif';
      ctx.fillStyle = isWhite ? '#db2777' : '#ec4899';
      ctx.fillText(defaultRightSignatoryName, rightCenterX, lineY - 4);
    }

    // Línea de firma derecha
    ctx.beginPath();
    ctx.moveTo(rightLineStart, lineY);
    ctx.lineTo(rightLineEnd, lineY);
    ctx.strokeStyle = signLineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Nombre y cargo Giantucchi derecho
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = mainTextColor;
    ctx.fillText(giantucchiSignatory, rightCenterX, lineY + 26);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = mutedColor;
    ctx.fillText('Academia Giantucchi', rightCenterX, lineY + 46);

  } else {
    // ═══════════════════════════════════════════════════════════════════════════
    // MODO FIRMA ÚNICA: Giantucchi Centrado + Metadatos Laterales Equilibrados
    // ═══════════════════════════════════════════════════════════════════════════
    const centerX = canvas.width / 2;
    const centerLineStart = centerX - 200;
    const centerLineEnd = centerX + 200;

    // Metadato Izquierdo: Fecha de Emisión
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = mainTextColor;
    ctx.fillText('Fecha de Emisión', 260, lineY + 22);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = mutedColor;
    ctx.fillText(dateStr, 260, lineY + 44);

    // Metadato Derecho: Código de Verificación ID
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = mainTextColor;
    ctx.fillText('Código de Verificación', canvas.width - 260, lineY + 22);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = idColor;
    ctx.fillText(certId, canvas.width - 260, lineY + 44);

    // Firma Central de Giantucchi
    if (giantucchiSignatureSrc) {
      const gSigImg = await loadImage(giantucchiSignatureSrc);
      if (gSigImg) {
        const maxWidth = 380;
        const maxHeight = 115;
        const aspect = gSigImg.width / gSigImg.height;
        let w = maxWidth;
        let h = maxWidth / aspect;
        if (h > maxHeight) { h = maxHeight; w = h * aspect; }
        // Firma casi al ras de la línea
        ctx.drawImage(gSigImg, centerX - w / 2, lineY - h + 6, w, h);
      } else {
        ctx.textAlign = 'center';
        ctx.font = 'italic 34px "Brush Script MT", "Segoe Script", cursive, serif';
        ctx.fillStyle = isWhite ? '#db2777' : '#ec4899';
        ctx.fillText(defaultRightSignatoryName, centerX, lineY - 4);
      }
    } else {
      ctx.textAlign = 'center';
      ctx.font = 'italic 34px "Brush Script MT", "Segoe Script", cursive, serif';
      ctx.fillStyle = isWhite ? '#db2777' : '#ec4899';
      ctx.fillText(defaultRightSignatoryName, centerX, lineY - 4);
    }

    // Línea de firma central
    ctx.beginPath();
    ctx.moveTo(centerLineStart, lineY);
    ctx.lineTo(centerLineEnd, lineY);
    ctx.strokeStyle = signLineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Nombre y cargo Giantucchi
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = mainTextColor;
    ctx.fillText(giantucchiSignatory, centerX, lineY + 26);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = mutedColor;
    ctx.fillText('Academia Giantucchi — Certificación Oficial', centerX, lineY + 46);
  }

  return canvas.toDataURL('image/png');
}

export async function downloadCertificate(data: CertificateData): Promise<void> {
  const dataUrl = await generateCertificatePNG(data);
  if (!dataUrl) return;

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `Certificado_${data.studentName.replace(/\s+/g, '_')}_DocentOS.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
