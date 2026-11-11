/**
 * Script de Auditoría y Conciliación de Exámenes (`scripts/reconcile-quiz-answers.ts`)
 *
 * Escanea todos los exámenes en la base de datos de producción y detecta inconsistencias
 * donde la opción marcada como correcta contradice la justificación pedagógica.
 *
 * Uso:
 *   npx tsx scripts/reconcile-quiz-answers.ts           # Modo simulación (Dry Run, solo reporta)
 *   npx tsx scripts/reconcile-quiz-answers.ts --dry-run # Modo simulación explícito
 *   npx tsx scripts/reconcile-quiz-answers.ts --fix     # Aplica las correcciones en la base de datos
 */

import { prisma } from '../server/prisma.js';
import { auditAndRepairAllQuizzes } from '../server/quizService.js';

async function main() {
  const args = process.argv.slice(2);
  const isFix = args.includes('--fix');
  const dryRun = !isFix;

  console.log('='.repeat(70));
  console.log(`🩺 AUDITORÍA Y CONCILIACIÓN DE EXÁMENES (DocentOS LMS)`);
  console.log(`   Modo: ${dryRun ? '🔍 SIMULACIÓN (Dry Run - No altera la BD)' : '🛠️ REPARACIÓN ACTIVA (--fix - Actualiza la BD)'}`);
  console.log('='.repeat(70));

  try {
    const summary = await auditAndRepairAllQuizzes({ dryRun });

    console.log(`\n📊 RESULTADOS DEL ANÁLISIS:`);
    console.log(`- Módulos con exámenes escaneados: ${summary.scannedModules}`);
    console.log(`- Total de preguntas analizadas:   ${summary.totalQuestions}`);
    console.log(`- Preguntas inconsistentes:        ${summary.inconsistentQuestionsCount}`);
    console.log(`- Módulos afectados:               ${summary.repairedModulesCount}`);

    if (summary.repairedQuestions.length > 0) {
      console.log(`\n📋 DETALLE DE PREGUNTAS CON DISCREPANCIA DETECTADAS:`);
      summary.repairedQuestions.forEach((item, idx) => {
        console.log(`\n[#${idx + 1}] Curso: "${item.courseTitle || 'N/A'}" | Módulo: "${item.moduleTitle || item.moduleId}"`);
        console.log(`  Pregunta:   "${item.questionText}"`);
        console.log(`  Opción Ant: [${String.fromCharCode(65 + item.oldCorrectIndex)}] "${item.oldOptionText}" (INCORRECTA SEGÚN JUSTIFICACIÓN)`);
        console.log(`  Opción Cor: [${String.fromCharCode(65 + item.newCorrectIndex)}] "${item.newOptionText}" (CORRECTA CONCILIADA)`);
        console.log(`  Explicación: "${item.explanation}"`);
        console.log(`  Motivo:      ${item.reason}`);
      });

      if (dryRun) {
        console.log('\n' + '!'.repeat(70));
        console.log('⚠️  Se detectaron inconsistencias. Para aplicar las correcciones ejecuta:');
        console.log('   npx tsx scripts/reconcile-quiz-answers.ts --fix');
        console.log('!'.repeat(70));
      } else {
        console.log('\n' + '='.repeat(70));
        console.log('✅ ¡Las correcciones fueron aplicadas con éxito en la base de datos!');
        console.log('='.repeat(70));
      }
    } else {
      console.log('\n✨ ¡Excelente! No se detectaron inconsistencias entre opciones y justificaciones pedagógicas.');
    }
  } catch (error) {
    console.error('❌ Error durante la auditoría de exámenes:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
