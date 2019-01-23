/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/
'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as tmp from 'tmp';
import * as sinonChai from 'sinon-chai';
import * as fs from 'fs-extra';
import * as fs_extra from 'fs-extra';
import * as child_process from 'child_process';
import { CommandUtil } from '../../src/util/CommandUtil';
import { UserInputUtil } from '../../src/commands/UserInputUtil';
import { TestUtil } from '../TestUtil';
import { VSCodeOutputAdapter } from '../../src/logging/VSCodeOutputAdapter';
import { Reporter } from '../../src/util/Reporter';
import { ExtensionUtil } from '../../src/util/ExtensionUtil';
import { LogType } from '../../src/logging/OutputAdapter';
import * as yeoman from 'yeoman-environment';

chai.use(sinonChai);

// Defines a Mocha test suite to group tests of similar kind together
// tslint:disable no-unused-expression
describe('CreateSmartContractProjectCommand', () => {
    // suite variables
    let mySandBox: sinon.SinonSandbox;
    let sendCommandStub: sinon.SinonStub;
    let sendCommandWithOutputAndProgressStub: sinon.SinonStub;
    let logSpy: sinon.SinonSpy;
    let quickPickStub: sinon.SinonStub;
    let openDialogStub: sinon.SinonStub;
    let executeCommandStub: sinon.SinonStub;
    let updateWorkspaceFoldersStub: sinon.SinonStub;
    let uri: vscode.Uri;
    let uriArr: Array<vscode.Uri>;

    before(async () => {
        await TestUtil.setupTests();
    });

    beforeEach(async () => {
        mySandBox = sinon.createSandbox();
        sendCommandStub = mySandBox.stub(CommandUtil, 'sendCommand');
        sendCommandWithOutputAndProgressStub = mySandBox.stub(CommandUtil, 'sendCommandWithOutputAndProgress');
        logSpy = mySandBox.spy(VSCodeOutputAdapter.instance(), 'log');
        quickPickStub = mySandBox.stub(vscode.window, 'showQuickPick');
        openDialogStub = mySandBox.stub(vscode.window, 'showOpenDialog');
        const originalExecuteCommand: any = vscode.commands.executeCommand;
        executeCommandStub = mySandBox.stub(vscode.commands, 'executeCommand');
        executeCommandStub.callsFake(async function fakeExecuteCommand(command: string): Promise<any> {
            // Don't open or close the folder as this causes lots of windows to popup, the
            // window to reload, random test failures, and duplicate test execution.
            if (command !== 'vscode.openFolder' && command !== 'workbench.action.closeFolder') {
                return originalExecuteCommand.apply(this, arguments);
            }
        });
        updateWorkspaceFoldersStub = mySandBox.stub(vscode.workspace, 'updateWorkspaceFolders');
        // Create a tmp directory for Smart Contract packages, and create a Uri of it
        uri = vscode.Uri.file(tmp.dirSync().name);
        uriArr = [uri];
    });
    afterEach(() => {
        mySandBox.restore();
    });

    // Define assertion
    it('should start a typescript smart contract project, in a new window', async () => {
        // We actually want to execute the command!
        sendCommandStub.restore();

        quickPickStub.onFirstCall().resolves('TypeScript');
        quickPickStub.onSecondCall().resolves(UserInputUtil.OPEN_IN_NEW_WINDOW);
        openDialogStub.resolves(uriArr);

        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        const pathToCheck: string = path.join(uri.fsPath, 'package.json');
        const smartContractExists: boolean = await fs_extra.pathExists(pathToCheck);
        const fileContents: string = await fs_extra.readFile(pathToCheck, 'utf8');
        const packageJSON: any = JSON.parse(fileContents);
        smartContractExists.should.be.true;
        executeCommandStub.should.have.been.calledTwice;
        executeCommandStub.should.have.been.calledWith('vscode.openFolder', uriArr[0], true);
        logSpy.should.have.been.calledWith(LogType.SUCCESS, 'Successfully generated smart contract project');
        packageJSON.name.should.equal(path.basename(uri.fsPath));
        packageJSON.version.should.equal('0.0.1');
        packageJSON.description.should.equal('My Smart Contract');
        packageJSON.author.should.equal('John Doe');
        packageJSON.license.should.equal('Apache-2.0');
    });

    it('should start a typescript smart contract project, in current window', async () => {
        // We actually want to execute the command!
        sendCommandStub.restore();

        quickPickStub.onFirstCall().resolves('TypeScript');
        quickPickStub.onSecondCall().resolves(UserInputUtil.OPEN_IN_CURRENT_WINDOW);
        openDialogStub.resolves(uriArr);

        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        const pathToCheck: string = path.join(uri.fsPath, 'package.json');
        const smartContractExists: boolean = await fs_extra.pathExists(pathToCheck);
        const fileContents: string = await fs_extra.readFile(pathToCheck, 'utf8');
        const packageJSON: any = JSON.parse(fileContents);
        smartContractExists.should.be.true;
        executeCommandStub.should.have.been.calledTwice;
        executeCommandStub.should.have.been.calledWith('vscode.openFolder', uriArr[0], false);
        logSpy.should.have.been.calledWith(LogType.SUCCESS, 'Successfully generated smart contract project');
        packageJSON.name.should.equal(path.basename(uri.fsPath));
        packageJSON.version.should.equal('0.0.1');
        packageJSON.description.should.equal('My Smart Contract');
        packageJSON.author.should.equal('John Doe');
        packageJSON.license.should.equal('Apache-2.0');
    });

    it('should start a typescript smart contract project, in current window with unsaved files and save', async () => {
        // We actually want to execute the command!
        sendCommandStub.restore();

        quickPickStub.onFirstCall().resolves('TypeScript');
        quickPickStub.onSecondCall().resolves(UserInputUtil.OPEN_IN_CURRENT_WINDOW);
        quickPickStub.onThirdCall().resolves(UserInputUtil.YES);
        openDialogStub.resolves(uriArr);

        const saveDialogStub: sinon.SinonStub = mySandBox.stub(vscode.workspace, 'saveAll').resolves(true);

        await vscode.workspace.openTextDocument({language: 'text', content: 'my text file'});

        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        const pathToCheck: string = path.join(uri.fsPath, 'package.json');
        const smartContractExists: boolean = await fs_extra.pathExists(pathToCheck);
        const fileContents: string = await fs_extra.readFile(pathToCheck, 'utf8');
        const packageJSON: any = JSON.parse(fileContents);
        smartContractExists.should.be.true;
        executeCommandStub.should.have.been.calledTwice;
        executeCommandStub.should.have.been.calledWith('vscode.openFolder', uriArr[0], false);
        saveDialogStub.should.have.been.calledWith(true);
        logSpy.should.have.been.calledWith(LogType.SUCCESS, 'Successfully generated smart contract project');
        packageJSON.name.should.equal(path.basename(uri.fsPath));
        packageJSON.version.should.equal('0.0.1');
        packageJSON.description.should.equal('My Smart Contract');
        packageJSON.author.should.equal('John Doe');
        packageJSON.license.should.equal('Apache-2.0');
    });

    it('should start a typescript smart contract project, in current window with unsaved files and not save', async () => {
        // We actually want to execute the command!
        sendCommandStub.restore();

        quickPickStub.onFirstCall().resolves('TypeScript');
        quickPickStub.onSecondCall().resolves(UserInputUtil.OPEN_IN_CURRENT_WINDOW);
        quickPickStub.onThirdCall().resolves(UserInputUtil.NO);
        openDialogStub.resolves(uriArr);

        const saveDialogStub: sinon.SinonStub = mySandBox.stub(vscode.workspace, 'saveAll');

        await vscode.workspace.openTextDocument({language: 'text', content: 'my text file'});

        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        const pathToCheck: string = path.join(uri.fsPath, 'package.json');
        const smartContractExists: boolean = await fs_extra.pathExists(pathToCheck);
        const fileContents: string = await fs_extra.readFile(pathToCheck, 'utf8');
        const packageJSON: any = JSON.parse(fileContents);
        smartContractExists.should.be.true;
        executeCommandStub.should.have.been.calledTwice;
        executeCommandStub.should.have.been.calledWith('vscode.openFolder', uriArr[0], false);
        saveDialogStub.should.not.have.been.called;
        logSpy.should.have.been.calledWith(LogType.SUCCESS, 'Successfully generated smart contract project');
        packageJSON.name.should.equal(path.basename(uri.fsPath));
        packageJSON.version.should.equal('0.0.1');
        packageJSON.description.should.equal('My Smart Contract');
        packageJSON.author.should.equal('John Doe');
        packageJSON.license.should.equal('Apache-2.0');
    });

    it('should start a typescript smart contract project, in a new workspace with no folders', async () => {
        // We actually want to execute the command!
        sendCommandStub.restore();

        // executeCommandStub.restore();

        quickPickStub.onFirstCall().resolves('TypeScript');
        quickPickStub.onSecondCall().resolves(UserInputUtil.ADD_TO_WORKSPACE);
        openDialogStub.resolves(uriArr);

        mySandBox.stub(vscode.workspace, 'workspaceFolders').value(undefined);

        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        const pathToCheck: string = path.join(uri.fsPath, 'package.json');
        const smartContractExists: boolean = await fs_extra.pathExists(pathToCheck);
        const fileContents: string = await fs_extra.readFile(pathToCheck, 'utf8');
        const packageJSON: any = JSON.parse(fileContents);
        smartContractExists.should.be.true;
        executeCommandStub.should.have.been.calledOnce;
        updateWorkspaceFoldersStub.should.have.been.calledWith(sinon.match.number, 0, {uri: uriArr[0]});
        logSpy.should.have.been.calledWith(LogType.SUCCESS, 'Successfully generated smart contract project');
        packageJSON.name.should.equal(path.basename(uri.fsPath));
        packageJSON.version.should.equal('0.0.1');
        packageJSON.description.should.equal('My Smart Contract');
        packageJSON.author.should.equal('John Doe');
        packageJSON.license.should.equal('Apache-2.0');
    });

    it('should start a typescript smart contract project, in a new workspace with folders', async () => {
        // We actually want to execute the command!
        sendCommandStub.restore();

        quickPickStub.onFirstCall().resolves('TypeScript');
        quickPickStub.onSecondCall().resolves(UserInputUtil.ADD_TO_WORKSPACE);
        openDialogStub.resolves(uriArr);

        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        const pathToCheck: string = path.join(uri.fsPath, 'package.json');
        const smartContractExists: boolean = await fs_extra.pathExists(pathToCheck);
        const fileContents: string = await fs_extra.readFile(pathToCheck, 'utf8');
        const packageJSON: any = JSON.parse(fileContents);
        smartContractExists.should.be.true;
        executeCommandStub.should.have.been.calledOnce;
        updateWorkspaceFoldersStub.should.have.been.calledWith(sinon.match.number, 0, {uri: uriArr[0]});
        logSpy.should.have.been.calledWith(LogType.SUCCESS, 'Successfully generated smart contract project');
        packageJSON.name.should.equal(path.basename(uri.fsPath));
        packageJSON.version.should.equal('0.0.1');
        packageJSON.description.should.equal('My Smart Contract');
        packageJSON.author.should.equal('John Doe');
        packageJSON.license.should.equal('Apache-2.0');
    });

    it('should show error if npm is not installed', async () => {
        // npm not installed
        const error: any = new Error('such error');
        error.stdout = error.stderr = 'could not find npm';
        sendCommandStub.onCall(0).rejects(error);
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        logSpy.should.have.been.calledWith(LogType.ERROR, 'npm is required before creating a smart contract project');
    });

    it('should show error is yo is not installed and not wanted', async () => {
        // yo not installed and not wanted
        const error: any = new Error('such error');
        error.stdout = '{}'; error.stderr = 'could not find yo';
        sendCommandStub.onCall(0).rejects(error);
        quickPickStub.resolves(UserInputUtil.NO);
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        logSpy.should.have.been.calledWith(LogType.ERROR, 'npm modules: yo and generator-fabric are required before creating a smart contract project');
    });

    it('should show error message if generator-fabric fails to install', async () => {
        // generator-fabric not installed and wanted but fails to install
        sendCommandStub.onCall(0).resolves(JSON.stringify({}));
        const error1: any = new Error('such error');
        error1.stdout = '{}'; error1.stderr = 'could not find generator-fabric';
        sendCommandStub.onCall(1).rejects(error1);
        quickPickStub.resolves(UserInputUtil.YES);
        const error2: any = new Error('such error');
        error2.stdout = ''; error2.stderr = 'could not install';
        sendCommandStub.onCall(1).rejects(error1);
        sendCommandStub.onCall(2).rejects(new Error('such error'));
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        logSpy.should.have.been.calledWith(LogType.ERROR, 'Issue installing generator-fabric module: such error');
    });

    it('should install yo if not installed', async () => {
        const error1: any = new Error('such error');
        error1.stdout = '{}'; error1.stderr = 'could not find yo';
        sendCommandStub.onCall(0).rejects(error1);
        quickPickStub.onCall(0).resolves(UserInputUtil.YES);
        sendCommandStub.onCall(1).resolves(JSON.stringify({
            dependencies: {
                'generator-fabric': {
                    version: '0.0.12'
                }
            }
        }));
        quickPickStub.onCall(1).resolves();
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        sendCommandStub.should.have.been.calledWithExactly('npm install -g yo');
    });

    it('should install generator-fabric if not installed', async () => {
        sendCommandStub.onCall(0).resolves(JSON.stringify({}));
        const error: any = new Error('such error');
        error.stdout = '{}'; error.stderr = 'could not find yo';
        sendCommandStub.onCall(1).rejects(error);
        quickPickStub.onCall(0).resolves(UserInputUtil.YES);
        quickPickStub.onCall(1).resolves();
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        sendCommandStub.should.have.been.calledWithExactly('npm install -g generator-fabric');
    });

    it('should install latest version of generator-fabric', async () => {
        sendCommandStub.onCall(0).resolves(JSON.stringify({}));
        const genFabVersion: string = '~0.0.11';
        mySandBox.stub(ExtensionUtil, 'getPackageJSON').returns({generatorFabricVersion: genFabVersion});
        sendCommandStub.onCall(1).resolves(JSON.stringify({
            dependencies: {
                'generator-fabric': {
                    version: '0.0.10'
                }
            }
        }));
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        sendCommandWithOutputAndProgressStub.should.have.been.calledOnceWithExactly('npm', ['install', '-g', `generator-fabric@${genFabVersion}`], 'Updating generator-fabric...', null, null, VSCodeOutputAdapter.instance());
    });

    it('should continue if latest version of generator-fabric is installed', async () => {
        sendCommandStub.onCall(0).resolves(JSON.stringify({}));
        mySandBox.stub(ExtensionUtil, 'getPackageJSON').returns({generatorFabricVersion: '~0.0.11'});
        sendCommandStub.onCall(1).resolves(JSON.stringify({
            dependencies: {
                'generator-fabric': {
                    version: '0.0.12'
                }
            }
        }));
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        sendCommandWithOutputAndProgressStub.should.not.have.been.called;
        logSpy.should.not.have.been.calledWith(LogType.SUCCESS, 'Successfully updated to latest version of generator-fabric');
    });

    it('should show error message if yo fails to install', async () => {
        // yo not installed and wanted but fails to install
        const error1: any = new Error('such error');
        error1.stdout = '{}'; error1.stderr = 'could not find yo';
        sendCommandStub.onCall(0).rejects(error1);
        quickPickStub.resolves(UserInputUtil.YES);
        const error2: any = new Error('such error');
        error2.stdout = '{}'; error2.stderr = 'could not install yo';
        sendCommandStub.onCall(1).rejects(error2);
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        logSpy.should.have.been.calledWith(LogType.ERROR, 'Issue installing yo node module: such error');
    });

    it('should show error message if we fail to create a smart contract', async () => {
        sendCommandStub.onCall(0).resolves(JSON.stringify({}));
        mySandBox.stub(ExtensionUtil, 'getPackageJSON').returns({generatorFabricVersion: '~0.0.11'});
        sendCommandStub.onCall(1).resolves(JSON.stringify({
            dependencies: {
                'generator-fabric': {
                    path: path.join(__dirname, '..', '..', '..', 'test', 'data', 'node_modules', 'generator-fabric'),
                    version: '0.0.11'
                }
            }
        }));
        sendCommandStub.onCall(2).resolves(JSON.stringify({
            dependencies: {
                'generator-fabric': {
                    path: path.join(__dirname, '..', '..', '..', 'test', 'data', 'node_modules', 'generator-fabric'),
                    version: '0.0.11'
                }
            }
        }));
        const mockEnv: any = {
            lookup: sinon.stub().yields(new Error('such error')),
            run: sinon.stub().yields(new Error('such error'))
        };
        mySandBox.stub(yeoman, 'createEnv').returns(mockEnv);
        quickPickStub.onCall(0).resolves('JavaScript');
        quickPickStub.onCall(1).resolves(UserInputUtil.OPEN_IN_NEW_WINDOW);
        openDialogStub.resolves(uriArr);
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        logSpy.should.have.been.calledWith(LogType.ERROR, 'Issue creating smart contract project: such error');
    });

    it('should not do anything if the user cancels the open dialog', async () => {
        // We actually want to execute the command!
        sendCommandStub.restore();

        quickPickStub.onCall(0).resolves('JavaScript');

        openDialogStub.resolves();
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        openDialogStub.should.have.been.calledOnce;
        executeCommandStub.should.have.been.calledOnce;
        executeCommandStub.should.have.not.been.calledWith('vscode.openFolder');
        logSpy.should.have.been.calledWithExactly(LogType.INFO, 'Getting smart contract languages...');
    });

    it('should not do anything if the user cancels the open project ', async () => {
        // We actually want to execute the command!
        sendCommandStub.restore();
        quickPickStub.onCall(0).resolves('JavaScript');
        quickPickStub.onCall(1).resolves();
        openDialogStub.resolves(uriArr);
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        openDialogStub.should.have.been.calledOnce;
        executeCommandStub.should.have.been.calledOnce;
        executeCommandStub.should.have.not.been.calledWith('vscode.openFolder');
        logSpy.should.have.been.calledWithExactly(LogType.INFO, 'Getting smart contract languages...');
    });

    // Go not currently supported as a smart contract language (targetted at Fabric v1.4).
    it.skip('should create a go smart contract project when the user selects go as the language', async () => {
        sendCommandStub.restore();

        const originalSpawn: any = child_process.spawn;
        const spawnStub: sinon.SinonStub = mySandBox.stub(child_process, 'spawn');
        spawnStub.withArgs('/bin/sh', ['-c', 'yo fabric:contract < /dev/null']).callsFake(() => {
            return originalSpawn('/bin/sh', ['-c', 'echo blah && echo "  Go" && echo "  JavaScript" && echo "  TypeScript  [45R"']);
        });
        quickPickStub.onCall(0).resolves('Go');
        openDialogStub.resolves(uriArr);

        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        const pathToCheck: string = path.join(uri.fsPath, 'main.go');
        const smartContractExists: boolean = await fs_extra.pathExists(pathToCheck);
        smartContractExists.should.be.true;
        spawnStub.should.have.been.calledWith('/bin/sh', ['-c', 'yo fabric:contract < /dev/null']);
        executeCommandStub.should.have.been.calledTwice;
        executeCommandStub.should.have.been.calledWith('vscode.openFolder', uriArr[0], true);
        logSpy.should.not.have.been.called;
    });

    it('should not do anything if the user cancels chosing a smart contract language', async () => {
        sendCommandStub.restore();
        quickPickStub.resolves(undefined);
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        quickPickStub.should.have.been.calledOnce;
        logSpy.should.have.been.calledWithExactly(LogType.INFO, 'Getting smart contract languages...');
        openDialogStub.should.not.have.been.called;
    });

    it('should show an error if generator-fabric package.json does not exist', async () => {
        sendCommandStub.onCall(0).resolves(JSON.stringify({}));
        mySandBox.stub(ExtensionUtil, 'getPackageJSON').returns({generatorFabricVersion: '~0.0.11'});
        sendCommandStub.onCall(1).resolves(JSON.stringify({
            dependencies: {
                'generator-fabric': {
                    path: path.join(__dirname, '..', '..', '..', 'test', 'data', 'node_modules', 'generator-fabric'),
                    version: '0.0.11'
                }
            }
        }));
        sendCommandStub.onCall(2).resolves(JSON.stringify({
            dependencies: {
                'generator-fabric': {
                    path: path.join(__dirname, '..', '..', '..', 'test', 'data', 'node_modules', 'generator-fabric'),
                    version: '0.0.11'
                }
            }
        }));
        mySandBox.stub(fs, 'readJson').rejects(new Error('such error'));
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        logSpy.should.have.been.calledWith(LogType.ERROR, sinon.match(/Could not load package.json for generator-fabric module/));
    });

    it('should show an error if contract languages doesnt exist in generator-fabric package.json', async () => {
        sendCommandStub.onCall(0).resolves(JSON.stringify({}));
        mySandBox.stub(ExtensionUtil, 'getPackageJSON').returns({generatorFabricVersion: '~0.0.11'});
        sendCommandStub.onCall(1).resolves(JSON.stringify({
            dependencies: {
                'generator-fabric': {
                    path: path.join(__dirname, '..', '..', '..', 'test', 'data', 'node_modules', 'generator-fabric'),
                    version: '0.0.11'
                }
            }
        }));
        sendCommandStub.onCall(2).resolves(JSON.stringify({
            dependencies: {
                'generator-fabric': {
                    path: path.join(__dirname, '..', '..', '..', 'test', 'data', 'node_modules', 'generator-fabric'),
                    version: '0.0.11'
                }
            }
        }));
        mySandBox.stub(fs, 'readJson').resolves({name: 'generator-fabric', version: '0.0.7'});
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        logSpy.should.have.been.calledWith(LogType.ERROR, sinon.match(/Contract languages not found in package.json for generator-fabric module/));
    });

    it('should send a telemetry event if the extension is for production', async () => {
        const getPackageJSONStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'getPackageJSON');
        getPackageJSONStub.onCall(0).returns({generatorFabricVersion: '0.0.11'}); // generator-fabric version check
        getPackageJSONStub.onCall(1).returns({production: false}); // To disable npm install!
        getPackageJSONStub.onCall(2).returns({production: true}); // For the reporter!
        const reporterStub: sinon.SinonStub = mySandBox.stub(Reporter.instance(), 'sendTelemetryEvent');

        sendCommandStub.restore();

        quickPickStub.onFirstCall().resolves('TypeScript');
        quickPickStub.onSecondCall().resolves(UserInputUtil.OPEN_IN_NEW_WINDOW);
        openDialogStub.resolves(uriArr);
        await vscode.commands.executeCommand('blockchain.createSmartContractProjectEntry');
        reporterStub.should.have.been.calledWith('createSmartContractProject', {contractLanguage: 'typescript'});
    });

}); // end of createFabricCommand tests
