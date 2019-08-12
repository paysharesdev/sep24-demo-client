import "./style.css";
import * as uiActions from "./ui/ui-actions";
const Config = require("./config");
const StellarSdk = require("stellar-sdk");

Config.listen(() => {
  const disclaimer = document.getElementById("mainnet-disclaimer");
  if (Config.get("MAINNET")) {
    disclaimer.classList.add("visible");
    StellarSdk.Network.usePublicNetwork();
  } else {
    disclaimer.classList.remove("visible");
    StellarSdk.Network.useTestNetwork();
  }
});

Config.installUI(document.querySelector("#config-form"));
if (!Config.isValid()) {
  uiActions.showConfig();
}

/**
 * State maintained between steps
 * @typedef {Object} State
 * @property {string} interactive_url - URL hosting the interactive webapp step
 * @property {string} challenge_transaction - XDR Representation of Stellar challenge transaction signed by server only
 * @property {Object} signed_challenge_tx - Stellar transaction challenge signed by both server and client
 * @property {string} token - JWT token representing authentication with stellar address from SEP10
 * @property {string} anchors_stellar_address - Address that the anchor will be expecting payment on for the in-flight transaction
 * @property {string} stellar_memo_type - Memo type for the stellar transaction to specify the anchor's transaction
 * @property {string} stellar_memo - Memo required for the specified stellar transaction
 * @property {string} external_transaction_id - The reference identifier needed to retrieve or confirm the withdrawal
 *
 * Deposit
 * @property {string} deposit_memo - The memo we asked the anchor to send our funds with
 * @property {string} deposit_type - The memo type we asked the anchor to send our funds with
 */

/**
 * @type State
 */
const state = {};

const withdrawSteps = [
  require("./steps/check_info"),
  require("./steps/SEP10/start"),
  require("./steps/SEP10/sign"),
  require("./steps/SEP10/send"),
  require("./steps/get_withdraw_unauth"),
  require("./steps/show_interactive_webapp"),
  require("./steps/confirm_payment"),
  require("./steps/send_stellar_transaction"),
  require("./steps/poll_for_success")
];

const depositSteps = [
  require("./steps/deposit/check_info"),
  require("./steps/SEP10/start"),
  require("./steps/SEP10/sign"),
  require("./steps/SEP10/send"),
  require("./steps/deposit/get_deposit"),
  require("./steps/show_interactive_webapp")
];

let steps = null;

uiActions.waitForPageMessage("pages/wallet.html").then(message => {
  if (message === "start-withdraw") {
    steps = withdrawSteps;
    next();
  } else if (message === "start-deposit") {
    steps = depositSteps;
    next();
  }
});

let currentStep = null;
const runStep = step => {
  if (!step) {
    uiActions.setAction("Finished");
    uiActions.setLoading(true, "Finished");
    return;
  }
  uiActions.setDevicePage(step.devicePage || "pages/loader.html");
  uiActions.instruction(step.instruction);
  uiActions.setAction(step.action);
  currentStep = step;
  if (Config.get("AUTO_ADVANCE") || step.autoStart) next();
};

const next = async () => {
  if (currentStep && currentStep.execute) {
    uiActions.setLoading(true);
    try {
      await Promise.all([
        currentStep.execute(state, uiActions),
        // Take at least a second for each step otherwise its overwhelming
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);
      steps.splice(0, 1);
    } catch (e) {
      uiActions.error(e);
      uiActions.setLoading(false);
      throw e;
    }

    uiActions.setLoading(false);
  }
  runStep(steps[0]);
};

uiActions.actionButton.addEventListener("click", next);
