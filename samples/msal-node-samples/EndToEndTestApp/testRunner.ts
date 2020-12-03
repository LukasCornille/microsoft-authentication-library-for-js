import { runCLI } from "jest";
import { Config } from "@jest/types";

const { readScenarioNames, readTestFiles } = require("./sampleUtils.js");
const { runSample } = require("./index.js");

const scenarios = readScenarioNames();
const tests = readTestFiles();

// Filter so only scenarios that have tests are executed
const testScenarios = scenarios.filter((scenario: string) => tests.includes(scenario));

async function runE2ETests() {
    // Using reduce instead of map to chain each test scenario execution in serial, initial accumulator is a dummy Promise
    const globalResults = await testScenarios.reduce(
        (currentScenarioPromise: Promise<string>, nextScenario: string) => {
            return currentScenarioPromise.then(() => {
                return testScenario(nextScenario);
            });
        }, Promise.resolve(null));

  Promise.all(globalResults).then(globalResults => {
      const globalFailedTests = globalResults.reduce((totalFailedTests: number, scenarioResults: any) => {
          return totalFailedTests + scenarioResults.results.numFailedTests;
      }, 0);
      // If any tests fail, exit with code 1 so CI/CD check fails
      process.exitCode = (globalFailedTests > 0) ? 1 : 0;
  })
}

async function testScenario (scenario: string): Promise<any> {
    const testCacheLocation = `${__dirname}/app/test/${scenario}/data/testCache.json`;
    const testLocation = `./app/test/${scenario}`;
    
    // Execute sample application under scenario configuration
    return await runSample(scenario, 3000, testCacheLocation).then(async (server: any) => {
        const args = {
            _: [] as any[],
            $0: '',
            roots: [testLocation],
            testTimeout: 30000
        };
        // Run tests for current scenario
        return await runCLI(args as Config.Argv, [testLocation]).then(results => {
            if(server) {
                console.log(`Tests for ${scenario} done, closing server`);
                server.close();
            }
            return results;
        });
    });
}

runE2ETests();