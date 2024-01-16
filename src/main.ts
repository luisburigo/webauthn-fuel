import Account, { base64ToHex, buildOptions } from 'authn-sign';
import {
  Address,
  BaseAssetId,
  bn,
  hashTransaction,
  Predicate,
  Provider,
  ScriptTransactionRequest,
  transactionRequestify
} from 'fuels';
import buildPredicate, { setData } from './predicate';

window.addEventListener('load', main);

const RECEIVER = 'fuel1jnluc5acjf5y4nh6a0y28499jhjj32x0ve8wk0hndugzpvyqn5xsfsfzly';

const state: { address: string, account: Account | null, balance: string, username: string, predicate: Predicate | null, provider: Provider | null } = {
  address: '',
  account: null,
  balance: '',
  username: '',
  predicate: null,
  provider: null,
};

function stop(timeout: number) {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

function selectById(id: string) {
  return document.getElementById(id)!;
}

async function createAccount() {
  const account = await Account.create(state.username || `account_${Math.floor(Math.random() * 10000)}`, { recover: true });
  const predicate = buildPredicate(state.provider!, await account.address())
  state.predicate = predicate;
  state.address = predicate.address.toAddress();
  state.account = account;
  return account;
}

async function recoverAccount() {
  const recovered = await (new Account()).sign('0x84', { recover: true });
  const account = new Account(
    state.username || `account_${Math.floor(Math.random() * 10000)}`,
    base64ToHex(recovered.id),
    '0x04' + recovered.recovered['publicKey' + 0].slice(2),
  );
  const predicate = buildPredicate(state.provider!, await account.address())
  state.predicate = predicate;
  state.address = predicate.address.toAddress();
  state.account = account;
  return account;
}

function getWallet() {
  return window.fuel!.getWallet(state.address);
}

async function getBalance() {
  const wallet = await getWallet();
  const balance = await wallet.getBalance();
  state.balance = `${balance.format()} ETH`;
}

async function transfer() {
  const tx = new ScriptTransactionRequest();
  tx.gasPrice = bn(1);
  tx.gasLimit = bn(50_000);
  const coins = await state.predicate!.getResourcesToSpend([
    {
      amount: bn.parseUnits('0.001'),
      assetId: BaseAssetId,
    },
  ]);
  tx.addResources(coins);
  const txHash = hashTransaction(transactionRequestify(tx), state.provider!.getChainId());
  const hash = txHash.slice(2).toLowerCase();
  const signature = await state.account!.sign(hash, { recover: true });

  // Set the predicate data.
  setData(
    state.predicate,
    signature.normalized,
    signature.authenticatorData,
    hash,
    signature.clientData.preChallengeEncoded,
    signature.clientData.postChallengeEncoded,
  );

  try {
    const tx = await state.predicate
      .transfer(RECEIVER, '0.001', BaseAssetId, {
        gasPrice: 1,
        gasLimit: 50_000, // 3_500_000, // 25_000,
      });

    // Wait for result.
    const result = await tx.waitForResult();

    console.log(result);
  } catch (e) {
    console.log(e);
  }
}

async function main() {
  const [
    $usernameInput,
    $accountText,
    $balanceText,
    // $sendBtn,
    $createBtn,
    $recoverBtn,
    $refreshBalance
  ] = [
    selectById('username') as HTMLInputElement,
    selectById('account') as HTMLParagraphElement,
    selectById('balance') as HTMLParagraphElement,
    // selectById('send') as HTMLButtonElement,
    selectById('create') as HTMLButtonElement,
    selectById('recover') as HTMLButtonElement,
    selectById('refresh') as HTMLButtonElement
  ];

  state.provider = await Provider.create('https://beta-4.fuel.network/graphql');

  $usernameInput.addEventListener('change', event =>
    // @ts-ignore
    state.username = event.target.value
  )

  $recoverBtn.addEventListener('click', async () => {
    try {
      await recoverAccount();
      await getBalance();

      $accountText.textContent = state.address;
      $balanceText.textContent = state.balance;

      $usernameInput.hidden = true;
      $createBtn.hidden = true;
      $recoverBtn.hidden = true;
      // $sendBtn.disabled = false;
      $refreshBalance.disabled = false;
    } catch (e) {
      alert('Error on create account.');
    }
  });

  $createBtn.addEventListener('click', async () => {
    try {
      await createAccount();
      await getBalance();

      $accountText.textContent = state.address;
      $balanceText.textContent = state.balance;

      $usernameInput.hidden = true;
      $createBtn.hidden = true;
      $recoverBtn.hidden = true;
      // $sendBtn.disabled = false;
      $refreshBalance.disabled = false;
    } catch (e) {
      alert('Error on create account.');
    }
  });

  $refreshBalance.addEventListener('click', async () => {
    await getBalance();
    $balanceText.textContent = state.balance;
  });

  // $sendBtn.addEventListener('click', async () => {
  //   await transfer();
  //   await stop(5000);
  //   await getBalance();
  //   $balanceText.textContent = state.balance;
  // })
}
