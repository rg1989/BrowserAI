#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Comprehensive test runner for page context monitoring system
 */

interface TestSuite {
    name: string;
    pattern: string;
    description: string;
    timeout?: number;
}

const TEST_SUITES: TestSuite[] = [
    {
        name: 'Core Monitoring Pipeline',
        pattern: 'e2e/page-context-monitoring.spec.ts',
        description: 'Tests the complete monitoring pipeline including network, DOM, and context collection',
        timeout: 120000
    },
    {
        name: 'Network Monitoring',
        pattern: 'e2e/network-monitoring.spec.ts',
        description: 'Tests network request/response monitoring and privacy controls',
        timeout: 90000
    },
    {
        name: 'Performance Validation',
        pattern: 'e2e/performance-validation.spec.ts',
        description: 'Tests monitoring system performance impact and optimization',
        timeout: 180000
    },
    {
        name: 'Privacy Validation',
        pattern: 'e2e/privacy-validation.spec.ts',
        description: 'Tests privacy controls, data redaction, and user consent mechanisms',
        timeout: 120000
    },
    {
        name: 'Plugin Integration',
        pattern: 'e2e/plugin-integration.spec.ts',
        description: 'Tests plugin API integration and enhanced context providers',
        timeout: 90000
    }
];

interface TestResults {
    suite: string;
    passed: boolean;
    duration: number;
    error?: string;
}

class MonitoringTestRunner {
    private results: TestResults[] = [];
    private startTime: number = 0;

    async runAllTests(): Promise<void> {
        console.log('🚀 Starting Page Context Monitoring Test Suite');
        console.log('='.repeat(60));

        this.startTime = Date.now();

        // Ensure extension is built
        await this.ensureExtensionBuilt();

        // Run each test suite
        for (const suite of TEST_SUITES) {
            await this.runTestSuite(suite);
        }

        // Generate summary report
        this.generateSummaryReport();
    }

    async runTestSuite(suite: TestSuite): Promise<void> {
        console.log(`\n📋 Running: ${suite.name}`);
        console.log(`📝 ${suite.description}`);
        console.log('-'.repeat(40));

        const suiteStartTime = Date.now();

        try {
            const command = this.buildPlaywrightCommand(suite);
            console.log(`🔧 Command: ${command}`);

            execSync(command, {
                stdio: 'inherit',
                cwd: path.join(__dirname, '..'),
                timeout: suite.timeout || 120000
            });

            const duration = Date.now() - suiteStartTime;
            this.results.push({
                suite: suite.name,
                passed: true,
                duration
            });

            console.log(`✅ ${suite.name} - PASSED (${this.formatDuration(duration)})`);

        } catch (error) {
            const duration = Date.now() - suiteStartTime;
            this.results.push({
                suite: suite.name,
                passed: false,
                duration,
                error: error instanceof Error ? error.message : String(error)
            });

            console.log(`❌ ${suite.name} - FAILED (${this.formatDuration(duration)})`);
            console.error(`Error: ${error}`);
        }
    }

    private buildPlaywrightCommand(suite: TestSuite): string {
        const baseCommand = 'npx playwright test';
        const options = [
            `--timeout=${suite.timeout || 120000}`,
            '--reporter=list',
            '--project=chromium',
            suite.pattern
        ];

        return `${baseCommand} ${options.join(' ')}`;
    }

    private async ensureExtensionBuilt(): Promise<void> {
        const buildPath = path.join(__dirname, '../build/chrome-mv3-prod');
        const manifestPath = path.join(buildPath, 'manifest.json');

        if (!existsSync(buildPath) || !existsSync(manifestPath)) {
            console.log('🔨 Building extension for testing...');

            try {
                execSync('npm run build:test', {
                    stdio: 'inherit',
                    cwd: path.join(__dirname, '..')
                });
                console.log('✅ Extension built successfully');
            } catch (error) {
                console.error('❌ Failed to build extension:', error);
                process.exit(1);
            }
        } else {
            console.log('✅ Extension build found');
        }
    }

    private generateSummaryReport(): void {
        const totalDuration = Date.now() - this.startTime;
        const passedTests = this.results.filter(r => r.passed).length;
        const failedTests = this.results.filter(r => !r.passed).length;

        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY REPORT');
        console.log('='.repeat(60));

        console.log(`⏱️  Total Duration: ${this.formatDuration(totalDuration)}`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`📈 Success Rate: ${((passedTests / this.results.length) * 100).toFixed(1)}%`);

        console.log('\n📋 Detailed Results:');
        console.log('-'.repeat(40));

        for (const result of this.results) {
            const status = result.passed ? '✅' : '❌';
            const duration = this.formatDuration(result.duration);
            console.log(`${status} ${result.suite} (${duration})`);

            if (!result.passed && result.error) {
                console.log(`   Error: ${result.error}`);
            }
        }

        if (failedTests > 0) {
            console.log('\n⚠️  Some tests failed. Please review the errors above.');
            console.log('💡 Tips for debugging:');
            console.log('   - Run individual test suites with: npm run test:e2e:monitoring:<suite>');
            console.log('   - Use headed mode for visual debugging: npm run test:e2e:headed');
            console.log('   - Check browser console for extension errors');
            process.exit(1);
        } else {
            console.log('\n🎉 All monitoring tests passed successfully!');
            console.log('✨ The page context monitoring system is working correctly.');
        }
    }

    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);

        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const runner = new MonitoringTestRunner();

    if (args.length === 0) {
        // Run all tests
        await runner.runAllTests();
    } else {
        // Run specific test suite
        const suiteName = args[0];
        const suite = TEST_SUITES.find(s =>
            s.name.toLowerCase().includes(suiteName.toLowerCase()) ||
            s.pattern.includes(suiteName)
        );

        if (suite) {
            console.log(`🎯 Running specific test suite: ${suite.name}`);
            await runner.runTestSuite(suite);
        } else {
            console.error(`❌ Test suite not found: ${suiteName}`);
            console.log('\n📋 Available test suites:');
            for (const s of TEST_SUITES) {
                console.log(`   - ${s.name}: ${s.pattern}`);
            }
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Test runner failed:', error);
        process.exit(1);
    });
}

export { MonitoringTestRunner, TEST_SUITES };