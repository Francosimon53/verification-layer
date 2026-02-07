import inquirer from 'inquirer';
import chalk from 'chalk';
import { trainingModules } from './modules.js';
import { questions } from './questions.js';
import { saveCertificate, printCertificate } from './certificate.js';

interface ModuleScore {
  correct: number;
  total: number;
  percentage: number;
}

export async function runTraining(): Promise<void> {
  console.clear();
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                                                                       ║'));
  console.log(chalk.bold.cyan('║            HIPAA SECURITY TRAINING FOR DEVELOPERS                     ║'));
  console.log(chalk.bold.cyan('║                                                                       ║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.white('Welcome to the HIPAA Security Training for Developers!\n'));
  console.log(chalk.gray('This interactive training covers 10 essential modules on HIPAA compliance,'));
  console.log(chalk.gray('security best practices, and secure coding for healthcare applications.\n'));
  console.log(chalk.yellow('📚 10 modules covering PHI, encryption, access control, APIs, and more'));
  console.log(chalk.yellow('❓ 45+ multiple-choice questions with explanations'));
  console.log(chalk.yellow('🏆 Certificate of completion with verification hash'));
  console.log(chalk.yellow('⏱️  Estimated time: 30-45 minutes\n'));

  const { ready } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'ready',
      message: 'Are you ready to begin?',
      default: true,
    },
  ]);

  if (!ready) {
    console.log(chalk.gray('\nTraining cancelled. Run "vlayer training" when you\'re ready.\n'));
    return;
  }

  const { name, email } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Enter your full name (for the certificate):',
      validate: (input) => input.trim().length > 0 || 'Name is required',
    },
    {
      type: 'input',
      name: 'email',
      message: 'Enter your email (optional):',
    },
  ]);

  const startTime = Date.now();
  let totalScore = 0;
  const moduleScores: Record<number, ModuleScore> = {};

  // Run through each module
  for (const module of trainingModules) {
    console.clear();
    await runModule(module);

    // Get questions for this module
    const moduleQuestions = questions.filter((q) => q.moduleId === module.id);
    let moduleCorrect = 0;

    for (const question of moduleQuestions) {
      const isCorrect = await askQuestion(question);
      if (isCorrect) {
        moduleCorrect++;
        totalScore++;
      }
    }

    moduleScores[module.id] = {
      correct: moduleCorrect,
      total: moduleQuestions.length,
      percentage: Math.round((moduleCorrect / moduleQuestions.length) * 100),
    };

    // Show module summary
    const percentage = Math.round((moduleCorrect / moduleQuestions.length) * 100);
    console.log(
      chalk.bold(
        `\n📊 Module ${module.id} Score: ${moduleCorrect}/${moduleQuestions.length} (${percentage}%)`
      )
    );

    if (percentage >= 80) {
      console.log(chalk.green('   Excellent work! 🌟\n'));
    } else if (percentage >= 60) {
      console.log(chalk.yellow('   Good effort! 👍\n'));
    } else {
      console.log(chalk.red('   Review this module. 📚\n'));
    }

    if (module.id < trainingModules.length) {
      const { continueTraining } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueTraining',
          message: 'Continue to next module?',
          default: true,
        },
      ]);

      if (!continueTraining) {
        console.log(
          chalk.gray(
            '\nTraining paused. Your progress has not been saved. Run "vlayer training" to start over.\n'
          )
        );
        return;
      }
    }
  }

  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 60000); // minutes

  // Show final results
  console.clear();
  await showFinalResults(
    name,
    email || undefined,
    totalScore,
    questions.length,
    moduleScores,
    duration
  );
}

async function runModule(module: typeof trainingModules[0]): Promise<void> {
  console.log(chalk.bold.cyan(`\n╔═══ MODULE ${module.id}: ${module.title.toUpperCase()} ${'═'.repeat(Math.max(0, 60 - module.title.length))}╗\n`));
  console.log(chalk.white.bold(module.description + '\n'));

  // Display content
  for (const line of module.content) {
    if (line === '') {
      console.log('');
    } else {
      console.log(chalk.gray(line));
    }
  }

  // Display code examples if available
  if (module.codeExamples && module.codeExamples.length > 0) {
    for (const example of module.codeExamples) {
      console.log(chalk.bold.red('\n❌ WRONG:\n'));
      console.log(chalk.red(example.wrong));

      console.log(chalk.bold.green('\n✅ RIGHT:\n'));
      console.log(chalk.green(example.right));

      console.log(chalk.bold('\n💡 Explanation:\n'));
      console.log(chalk.gray(example.explanation));
    }
  }

  console.log(
    chalk.bold.cyan(`\n╚${'═'.repeat(Math.max(0, 69))}╝\n`)
  );

  const { readyForQuestions } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'readyForQuestions',
      message: 'Ready for the questions?',
      default: true,
    },
  ]);

  if (!readyForQuestions) {
    console.log(chalk.gray('Take your time. Press any key when ready...\n'));
    await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: 'Ready now?',
        default: true,
      },
    ]);
  }

  console.log('');
}

async function askQuestion(
  question: typeof questions[0]
): Promise<boolean> {
  const { answer } = await inquirer.prompt([
    {
      type: 'list',
      name: 'answer',
      message: question.question,
      choices: question.options,
    },
  ]);

  const selectedIndex = question.options.indexOf(answer);
  const isCorrect = selectedIndex === question.correctAnswer;

  if (isCorrect) {
    console.log(chalk.green.bold('  ✓ Correct!\n'));
  } else {
    console.log(chalk.red.bold('  ✗ Incorrect.\n'));
    console.log(
      chalk.yellow(`  The correct answer is: ${question.options[question.correctAnswer]}\n`)
    );
  }

  console.log(chalk.gray(`  💡 ${question.explanation}\n`));

  return isCorrect;
}

async function showFinalResults(
  name: string,
  email: string | undefined,
  score: number,
  total: number,
  moduleScores: Record<number, ModuleScore>,
  duration: number
): Promise<void> {
  const percentage = Math.round((score / total) * 100);
  const passed = percentage >= 70;

  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                         TRAINING COMPLETE!                            ║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.white(`Name: ${name}`));
  if (email) {
    console.log(chalk.white(`Email: ${email}`));
  }
  console.log(chalk.white(`Duration: ${duration} minutes\n`));

  console.log(chalk.bold('📊 Final Score:\n'));
  console.log(chalk.white(`   ${score}/${total} questions correct (${percentage}%)\n`));

  console.log(chalk.bold('📈 Module Breakdown:\n'));
  for (const [moduleId, scores] of Object.entries(moduleScores)) {
    const module = trainingModules.find((m) => m.id === parseInt(moduleId));
    const bar = '█'.repeat(Math.round(scores.percentage / 5)) + '░'.repeat(20 - Math.round(scores.percentage / 5));
    const color = scores.percentage >= 80 ? chalk.green : scores.percentage >= 60 ? chalk.yellow : chalk.red;

    console.log(
      color(`   Module ${moduleId}: ${module?.title.padEnd(45)} ${bar} ${scores.percentage}% (${scores.correct}/${scores.total})`)
    );
  }

  console.log('');

  if (passed) {
    console.log(chalk.green.bold('🎉 CONGRATULATIONS! You passed the training!\n'));
    console.log(chalk.green('You have successfully completed the HIPAA Security Training.'));
    console.log(chalk.green('Your certificate has been generated below.\n'));
  } else {
    console.log(chalk.yellow.bold('⚠️  You did not pass the training (70% required).\n'));
    console.log(chalk.yellow('Review the modules and try again. Run "vlayer training" to restart.'));
    console.log(chalk.yellow('Your score has been recorded but no certificate was generated.\n'));
    return;
  }

  // Save certificate
  const { certificate, path } = await saveCertificate(
    name,
    email,
    score,
    total,
    moduleScores,
    duration
  );

  // Print certificate
  console.log(chalk.cyan(printCertificate(certificate)));

  console.log(chalk.gray(`\n📄 Certificate saved to: ${path}\n`));
  console.log(chalk.gray('Share your verification hash to prove completion!\n'));
}

export async function showTrainingStatus(): Promise<void> {
  const { readdir } = await import('fs/promises');
  const { join } = await import('path');
  const { homedir } = await import('os');

  const trainingDir = join(homedir(), '.vlayer', 'training');

  try {
    const files = await readdir(trainingDir);
    const certificates = files.filter((f) => f.endsWith('.json'));

    if (certificates.length === 0) {
      console.log(chalk.yellow('\n⚠️  No training certificates found.\n'));
      console.log(chalk.gray('Run "vlayer training" to complete the training and earn a certificate.\n'));
      return;
    }

    console.log(chalk.bold.cyan('\n📚 Training Completion Status:\n'));

    for (const certFile of certificates) {
      const certPath = join(trainingDir, certFile);
      const certContent = await import('fs/promises').then((fs) =>
        fs.readFile(certPath, 'utf-8')
      );
      const cert = JSON.parse(certContent);

      const status = cert.percentage >= 70 ? chalk.green('✓ PASSED') : chalk.red('✗ FAILED');
      const date = new Date(cert.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      console.log(chalk.white(`${status}  ${cert.name.padEnd(30)} ${cert.percentage}% ${chalk.gray(`(${date})`)}`));
      if (cert.email) {
        console.log(chalk.gray(`       ${cert.email}`));
      }
      console.log(chalk.gray(`       Hash: ${cert.hash.substring(0, 40)}...`));
      console.log('');
    }

    console.log(chalk.gray(`Total certificates: ${certificates.length}\n`));
  } catch (error) {
    console.log(chalk.yellow('\n⚠️  No training records found.\n'));
    console.log(chalk.gray('Run "vlayer training" to complete the training.\n'));
  }
}
