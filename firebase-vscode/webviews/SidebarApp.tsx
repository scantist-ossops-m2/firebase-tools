import {
  VSCodeButton, VSCodeCheckbox, VSCodeDivider, VSCodeLink, VSCodeProgressRing, VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react";
import React, { useEffect, useState } from "react";
import { Spacer } from "./components/ui/Spacer";
import { Body } from "./components/ui/Text";
import { broker } from "./globals/html-broker";
import { User } from "../../src/types/auth";
import { FirebaseRC } from "../../src/firebaserc";
import { PanelSection } from "./components/ui/PanelSection";
import { AccountSection } from "./components/AccountSection";
import { ProjectSection } from "./components/ProjectSection";
import { FirebaseConfig } from "../../src/firebaseConfig";
import { ServiceAccountUser } from "../common/types";
import { RunningEmulatorInfo, EmulatorUiSelections } from "../common/messaging/protocol";
import { DeployPanel } from "./components/DeployPanel";
import { HostingState } from "./webview-types";
import { ChannelWithId } from "./messaging/types";
import { VSCodeDropdown } from "@vscode/webview-ui-toolkit/react";
import { VSCodeOption } from "@vscode/webview-ui-toolkit/react";

const DEFAULT_EMULATOR_UI_SELECTIONS: EmulatorUiSelections = { projectId: "demo-something", firebaseJsonPath: "", importStateFolderPath: "", exportStateOnExit: false, mode: "all", debugLogging:false };

export function SidebarApp() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [hostingState, setHostingState] = useState<HostingState>(null);
  const [env, setEnv] = useState<{ isMonospace: boolean }>();
  const [channels, setChannels] = useState<ChannelWithId[]>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  /**
   * null - has not finished checking yet
   * empty array - finished checking, no users logged in
   * non-empty array - contains logged in users
   */
  const [allUsers, setAllUsers] = useState<Array<
    ServiceAccountUser | User
  > | null>(null);
  const [isHostingOnboarded, setHostingOnboarded] = useState<boolean>(false);
  // TODO emulators running check on extension start
  const [runningEmulatorInfo, setRunningEmulatorInfo] = useState<RunningEmulatorInfo>();
  const [showEmulatorProgressIndicator, setShowEmulatorProgressIndicator] = useState<boolean>(false);
  // FIXME hardcoded for now ....
  const [selectedFirebaseJsonInDropdown, setSelectedFirebaseJsonInDropdown] = useState<string>("/usr/local/google/home/christhompson/firebaseprojects/firebaseclicker/firebase.json");
  const [emulatorUiSelections, setEmulatorUiSelections] = useState<EmulatorUiSelections>(DEFAULT_EMULATOR_UI_SELECTIONS);

  console.log("initial state ui selections:" + JSON.stringify(emulatorUiSelections));
  function setEmulatorUiSelectionsAndSaveToWorkspace(uiSelections:EmulatorUiSelections) {
    // FIXME save before updating UI. Requires context
    setEmulatorUiSelections(uiSelections);
  }

  // FIXME load from save on startup

  useEffect(() => {
    console.log("loading SidebarApp component");
    broker.send("getEnv");
    broker.send("getUsers");
    broker.send("getFirebaseJson");
    broker.send("getSelectedProject");
    broker.send("getChannels");
    broker.send("getFirebaseJsonPath");

    broker.on("notifyEnv", (env) => {
      console.log("notifyEnv()");
      setEnv(env);
    });

    broker.on("notifyChannels", (channels) => {
      console.log("notifyChannels()");
      setChannels(channels);
    });

    broker.on(
      "notifyFirebaseJson",
      (firebaseJson: FirebaseConfig, firebaseRC: FirebaseRC) => {
        console.log("got firebase hosting", firebaseJson?.hosting);
        if (firebaseJson?.hosting) {
          console.log("Detected hosting setup");
          setHostingOnboarded(true);
          broker.send(
            "showMessage",
            "Auto-detected hosting setup in this folder"
          );
        } else {
          setHostingOnboarded(false);
        }

        if (firebaseRC?.projects?.default) {
          console.log("Detected project setup from existing firebaserc");
          setProjectId(firebaseRC.projects.default);
        } else {
          setProjectId(null);
        }
      }
    );

    broker.on("notifyUsers", (users: User[]) => {
      console.log("notifyUsers()");
      setAllUsers(users);
    });

    broker.on("notifyProjectChanged", (projectId: string) => {
      console.log("Project selected", projectId);
      setProjectId(projectId);
    });

    broker.on("notifyUserChanged", (email) => {
      console.log("notifyUserChanged:", email);
      setUserEmail(email);
    });

    broker.on("notifyHostingFolderReady", (projectId, folderPath) => {
      console.log(`notifyHostingFolderReady: ${projectId}, ${folderPath}`);
      setHostingOnboarded(true);
    });

    broker.on("notifyHostingDeploy", (success: boolean) => {
      console.log(`notifyHostingDeploy: ${success}`);
      setHostingState("deployed");
    });

    broker.on("notifyEmulatorsStopped", () => {
      setShowEmulatorProgressIndicator(false);
      console.log(`notifyEmulatorsStopped received in sidebar`);
      setRunningEmulatorInfo(null);
    });

    broker.on("notifyRunningEmulatorInfo", (info: RunningEmulatorInfo) => {
      setShowEmulatorProgressIndicator(false);
      console.log(`notifyRunningEmulatorInfo received in sidebar`);
      setRunningEmulatorInfo(info);
    });

    broker.on("notifyFirebaseJsonPath", (path: string) => {
      console.log(`notifyFirebaseJsonPath received in sidebar`);
      var selections: EmulatorUiSelections = emulatorUiSelections;
      selections.firebaseJsonPath = path;
      selections = {...selections}; // Copy to a new object to force a react rerender
      setEmulatorUiSelectionsAndSaveToWorkspace(selections);
    });

    // return () => broker.delete();
  }, []);

  const setupHosting = () => {
    broker.send(
      "selectAndInitHostingFolder",
      projectId,
      userEmail!, // Safe to assume user email is already there
      /*singleAppSupport*/ true
    );
  };

  function launchEmulators() {
    if (!emulatorUiSelections.projectId) {
      broker.send("showMessage", "Missing project ID", {
        modal: true,
        detail: `Please specify a project ID before starting the emulator suite.`,
      });
      return;
    }
    setShowEmulatorProgressIndicator(true);
    broker.send(
      "launchEmulators",
      selectedFirebaseJsonInDropdown,
      emulatorUiSelections
    );
  };

  function stopEmulators() {
    setShowEmulatorProgressIndicator(true);
    broker.send(
      "stopEmulators"
    );
  };
  
  /**
   * Clears the input field and adds it to the dropdown instead
   */
  function selectFirebaseJson() {
    const filePicked = (document.getElementById("json-file-picker") as HTMLInputElement).value;
    (document.getElementById("json-file-picker") as HTMLInputElement).value = "";
    console.log("selectFirebaseJson ping" + filePicked);
    const element: HTMLOptionElement = new Option();
    element.innerHTML = filePicked;
    element.value = filePicked;
    (document.getElementById("firebase-json-dropdown") as HTMLSelectElement).prepend(element);
    (document.getElementById("firebase-json-dropdown") as HTMLSelectElement).value = filePicked;
    // FIXME now select it, this is buggy
  //   const options: vscode.OpenDialogOptions = {
  //     canSelectMany: false,
  //     openLabel: 'Select',
  //     canSelectFiles: true,
  //     canSelectFolders: false
  // };
    // window.showOpenDialog().then(fileUri => {
    //   if (fileUri && fileUri[0]) {
    //       console.log('Selected file: ' + fileUri[0].fsPath);
    //   }
    // });
  };

  /**
   * Called when import folder changes.
   */
  function selectedImportFolder(event: React.ChangeEvent<HTMLInputElement>) {
    console.log("selectedImportFolder: " + event.target.value);
    var selections: EmulatorUiSelections = emulatorUiSelections;
    selections.importStateFolderPath = event.target.value;
    selections = {...selections}; // FIXME Copy to a new object to force a react rerender
    setEmulatorUiSelectionsAndSaveToWorkspace(selections);
  }
  
  function toggleExportOnExit() {
    console.log("toggle export on exit");
    const selections: EmulatorUiSelections = emulatorUiSelections;
    selections.exportStateOnExit = !selections.exportStateOnExit;
    setEmulatorUiSelectionsAndSaveToWorkspace(selections);
  }
  
  function projectIdChanged(event: React.ChangeEvent<HTMLInputElement>) {
    console.log("projectIdChanged: " + event.target.value);
    const selections: EmulatorUiSelections = emulatorUiSelections;
    selections.projectId = event.target.value;
    setEmulatorUiSelectionsAndSaveToWorkspace(selections);
  }

  const accountSection = (
    <AccountSection
      userEmail={userEmail}
      allUsers={allUsers}
      isMonospace={env?.isMonospace}
    />
  );
  // Just render the account section loading view if it doesn't know user state
  if (allUsers === null) {
    return (<>
      <Spacer size="medium" />
      {accountSection}
    </>);
  }

  return (
    <>
      <Spacer size="medium" />
      {accountSection}
      {!!userEmail && <ProjectSection userEmail={userEmail} projectId={projectId} />}
      {isHostingOnboarded && !!userEmail && !!projectId && (
        <DeployPanel
          hostingState={hostingState}
          setHostingState={setHostingState}
          projectId={projectId}
          channels={channels}
        />
      )}
      <Spacer size="large" />
      {!isHostingOnboarded && !!userEmail && !!projectId && (
        <InitFirebasePanel
          onHostingInit={() => {
            setupHosting();
          }}
        />
      )}
      <RunEmulatorPanel
        runningEmulatorInfo={runningEmulatorInfo}
        showEmulatorProgressIndicator={showEmulatorProgressIndicator}
        emulatorUiSelections={emulatorUiSelections}
        launchEmulators={launchEmulators}
        stopEmulators={stopEmulators}
        selectFirebaseJson={selectFirebaseJson}
        selectedImportFolder={selectedImportFolder}
        toggleExportOnExit={toggleExportOnExit}
        projectIdChanged={projectIdChanged}
      />
    </>
  );
}

function InitFirebasePanel({ onHostingInit }: { onHostingInit: Function }) {
  return (
    <PanelSection isLast>
      <Body>Choose a path below to get started</Body>
      <Spacer size="medium" />
      <VSCodeButton onClick={() => onHostingInit()}>
        Host your web app
      </VSCodeButton>
      <Spacer size="medium" />
      <Body>Free web hosting with a world-class CDN for peak performance</Body>
      <Spacer size="large" />
    </PanelSection>
  );
}
// FIXME move this out to a component
function RunEmulatorPanel(
  {
    runningEmulatorInfo,
    showEmulatorProgressIndicator,
    emulatorUiSelections,
    launchEmulators,
    stopEmulators,
    selectFirebaseJson,
    selectedImportFolder,
    toggleExportOnExit,
    projectIdChanged
  }:
    {
      runningEmulatorInfo: RunningEmulatorInfo,
      showEmulatorProgressIndicator: boolean,
      emulatorUiSelections: EmulatorUiSelections
      launchEmulators: Function,
      stopEmulators: Function,
      selectFirebaseJson: Function
      selectedImportFolder: Function
      toggleExportOnExit: Function
      projectIdChanged: Function
    }) {

  return (
    <PanelSection>
      <h2>Launch the Emulator Suite</h2>
      <Spacer size="xxlarge" />
      Current project ID:
      <VSCodeTextField className="in-line" value={emulatorUiSelections.projectId} onChange={(event) => projectIdChanged(event)}></VSCodeTextField>
      <button className="in-line">edit</button>
      <Spacer size="xxlarge" />
      Firebase JSON selected: <br />
      <VSCodeTextField disabled="true" value={emulatorUiSelections.firebaseJsonPath}>

      </VSCodeTextField>
      <input disabled={!!runningEmulatorInfo} type="file" id="json-file-picker" onChange={(event) => selectFirebaseJson()} />
      <Spacer size="xxlarge" />
      Import emulator state from directory: FIXME
      <Spacer size="small" />
      <input disabled={!!runningEmulatorInfo} type="file" id="import-folder-picker" onChange={(event) => selectedImportFolder(event)} />
      <Spacer size="small" />
      <VSCodeButton appearance="secondary">Clear</VSCodeButton>
      <Spacer size="xxlarge" />
      <VSCodeCheckbox disabled={!emulatorUiSelections.importStateFolderPath} value={emulatorUiSelections.exportStateOnExit} onChange={() => toggleExportOnExit()}>
        Export emulator state on exit
      </VSCodeCheckbox>
      <Spacer size="xxlarge" />
      {showEmulatorProgressIndicator ?
        <VSCodeProgressRing />
        : <></>}
        Emulator "mode"
        <VSCodeDropdown>
          <VSCodeOption>
          Only hosting
          </VSCodeOption>
          <VSCodeOption>
          All emulators
          </VSCodeOption>
        </VSCodeDropdown>
      {runningEmulatorInfo ?
        <>
          <VSCodeDivider />
          <Spacer size="xxlarge" />
          The emulators are running.
          <Spacer size="xxlarge" />
          <VSCodeLink href={runningEmulatorInfo.uiUrl}>
            View them in the Emulator Suite UI
          </VSCodeLink>
          <Spacer size="xxlarge" />
          {runningEmulatorInfo.displayInfo}
          <Spacer size="xxlarge" />
          <VSCodeButton onClick={() => stopEmulators()}>
            Click to stop the emulators
          </VSCodeButton>
        </>
        :
        <VSCodeButton onClick={() => launchEmulators()} disabled={showEmulatorProgressIndicator ? true : false}>
          Launch emulators
        </VSCodeButton>
      }
      <Spacer size="xxlarge" />
      <Spacer size="xxlarge" />
      <Spacer size="xxlarge" />
      <Spacer size="xxlarge" />


      <br />TODO persist settings on reload
      <br />TODO emulator:exec mode - right now they need to launch and THEN launch the app.
      <br />TODO dummy config for no json - useful?
      <br />TODO debug options:
      <br />&nbsp;logging passthrough to console for faster debugging - perhaps in some secret options
      <br />&nbsp;open debug files in editor
      <br />&nbsp;debug flag set for additional diagnostic logging
      <br />&nbsp;clear [emualtor] state back to default
      <Spacer size="medium" />
      <br />Later:
      <br />SDK resolution of project IDs (demo)
      <br />SDK auto-connect to emulator (set env var perhaps)
      https://github.com/firebase/firebase-js-sdk/blob/2ccc9ddb0ee875cf5a14bbc1ca473b576b9105bf/packages/util/src/defaults.ts#L135
      <br />TODO on restart check if emulators already running. Right now it's throwing exit() but swallowed

    </PanelSection>
  );
}
