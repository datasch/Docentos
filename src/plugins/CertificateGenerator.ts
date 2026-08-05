/**
 * Generador de Certificados Oficiales en Canvas de Alto Rendimiento
 * Academia Giantucchi Open Source
 */

export interface CertificateData {
  studentName: string;
  courseTitle: string;
  institutionName?: string;
  signatoryTitle?: string;
  primaryColor?: string;
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

export function generateCertificatePNG(data: CertificateData): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1130; // Aspect ratio ~ 1.41 (A4 horizontal)

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const primaryColor = data.primaryColor || '#06b6d4';
  const institution = data.institutionName || 'DocentOS Academy';
  const signatory = data.signatoryTitle || 'Dirección de Mentoria & Certificación';
  const badge = data.badgeText || 'CERTIFICADO DE EXCELENCIA TÉCNICA';
  const dateStr = data.dateStr || new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const certId = data.certificateId || `DOCENTOS-CERT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  // 1. Fondo Oscuro Elegante
  ctx.fillStyle = '#0a0a12';
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
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
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

  // 4. Encabezado de la Institución
  ctx.textAlign = 'center';

  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = primaryColor;
  ctx.fillText(institution.toUpperCase(), canvas.width / 2, 160);

  // Insignia / Badge
  ctx.font = '800 20px sans-serif';
  ctx.fillStyle = '#a855f7';
  ctx.fillText(`★ ${badge} ★`, canvas.width / 2, 210);

  // Línea divisoria
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 200, 240);
  ctx.lineTo(canvas.width / 2 + 200, 240);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 5. Texto Principal
  ctx.font = '300 28px sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('Se otorga el presente reconocimiento oficial a:', canvas.width / 2, 330);

  // Nombre del Estudiante (Grande y Destacado)
  ctx.font = 'bold 64px serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.studentName, canvas.width / 2, 420);

  // Subtexto
  ctx.font = '300 24px sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('Por haber completado satisfactoriamente el programa de formación:', canvas.width / 2, 500);

  // Título del Curso (con Text Wrapping seguro para evitar desbordamiento)
  ctx.font = 'bold 40px sans-serif';
  const courseGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  courseGrad.addColorStop(0.3, primaryColor);
  courseGrad.addColorStop(0.7, '#a855f7');
  ctx.fillStyle = courseGrad;

  const rawTitle = `"${data.courseTitle}"`;
  const wrappedLines = wrapText(ctx, rawTitle, 1200);
  const startY = 570;
  const lineHeight = 52;

  wrappedLines.forEach((line, idx) => {
    ctx.fillText(line, canvas.width / 2, startY + idx * lineHeight);
  });

  // 6. Sello Dorado de Verificación Digital
  ctx.save();
  ctx.translate(canvas.width / 2, 790);

  // Círculo Sello
  ctx.beginPath();
  ctx.arc(0, 0, 56, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(234, 179, 8, 0.15)';
  ctx.fill();
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#eab308';
  ctx.fillText('VERIFIED', 0, -6);
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('DOCENTOS ACADEMY', 0, 16);
  ctx.restore();

  // 7. Pie de Página: Fecha y Firma
  // Fecha (Izquierda)
  ctx.textAlign = 'left';
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Fecha de Emisión: ${dateStr}`, 140, 960);
  ctx.font = '14px monospace';
  ctx.fillStyle = '#64748b';
  ctx.fillText(`ID de Verificación: ${certId}`, 140, 990);

  // Firma del Mentor (Derecha)
  ctx.textAlign = 'right';
  ctx.font = 'italic bold 30px serif';
  ctx.fillStyle = primaryColor;
  ctx.fillText('Firma de Verificación', canvas.width - 140, 930);

  ctx.beginPath();
  ctx.moveTo(canvas.width - 380, 945);
  ctx.lineTo(canvas.width - 140, 945);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(signatory, canvas.width - 140, 975);

  return canvas.toDataURL('image/png');
}

export function downloadCertificate(data: CertificateData) {
  const dataUrl = generateCertificatePNG(data);
  if (!dataUrl) return;

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `Certificado_${data.studentName.replace(/\s+/g, '_')}_DocentOS.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
