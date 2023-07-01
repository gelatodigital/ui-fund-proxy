import { useEffect, useState } from "react";
import { Status, State, DedicatedMsgSender, Chain } from "../../types/Status";
import { BiRefresh, BiCopy } from "react-icons/bi";

import { Contract, ethers } from "ethers";
import metamask from "../../assets/images/metamask.png";
import Header from "../Header";

import "./style.css";
import { AutomateSDK } from "@gelatonetwork/automate-sdk";
import Action from "../Action";
import Loading from "../Loading";
import Button from "../Button";

const App = () => {
  // these could potentially be unified into one provider
  // provider will initially be the static JsonRpcProvider (read-only)
  // once a wallet is connected it will be set to the WalletProvider (can sign)

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<ethers.Contract | null>(null);

  const [provider, setProvider] =
    useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [signerAddress, setSignerAddress] = useState<string | null>(null);
  const [signerBalance, setSignerBalance] = useState<string>("0");
  const [chainId, setChainId] = useState<Chain>({ name: "", id: 0 });

  const [dedicatedMsgSender, setDedicatedMsgSender] =
    useState<DedicatedMsgSender>({
      address: "",
      isDeployed: false,
      balance: "0",
    });

  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [max, setMax] = useState<boolean>(false);
  const [connectStatus, setConnectStatus] = useState<Status | null>({
    state: State.missing,
    message: "Loading",
  });

  if (typeof window.ethereum != "undefined") {
    window.ethereum.on("accountsChanged", () => {
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      setLoading(true);
      refresh(web3Provider);
    });

    window.ethereum.on("chainChanged", () => {
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      setLoading(true);
      refresh(web3Provider);
    });
  }

  const onDisconnect = async () => {
    setConnectStatus({
      state: State.failed,
      message: "Waiting for Disconnection",
    });

    await window.ethereum.request({
      method: "eth_requestAccounts",
      params: [
        {
          eth_accounts: {},
        },
      ],
    });
  };

  const onConnect = async () => {
    console.log('connec')
    try {
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [
          {
            eth_accounts: {}
          }
        ]
      });
    } catch (error) {}
  };

  const onCopy = async (text: string) => {
    if ("clipboard" in navigator) {
      await navigator.clipboard.writeText(text);
    } else {
      document.execCommand("copy", true, text);
    }
    alert("Copied to Clipboard");
  };

  const onUpdate = async (value: number, action: number) => {
    switch (action) {
      case 0:
        setDepositAmount(value);
        break;
      case 1:
        setWithdrawAmount(value);
        break;
      case 2:
        setLoading(true);
        if (max == false) {
          const maxBalance = await provider?.getBalance(
            dedicatedMsgSender.address!
          );
          const format = +ethers.utils.formatEther(maxBalance!);
          setWithdrawAmount(format);
        } else {
          setWithdrawAmount(0);
        }
        setMax(!max);
        setLoading(false);
        break;
      default:
        console.log("do nothing");
        break;
    }
  };

  const onAction = async (action: number) => {
    setLoading(true);
    switch (action) {
      case 0:
        console.log("deposit", depositAmount);
        if (depositAmount <= 0) {
          setLoading(false);
          alert("Amount must be >0");

          return;
        }
        const amountToDeposit = ethers.utils.parseEther(
          depositAmount.toString()
        );

        const maxBalanceSigner = await provider?.getBalance(signerAddress!);

        if (amountToDeposit.gt(maxBalanceSigner!)) {
          setLoading(false);
          alert(
            `Max Balance = ${(+ethers.utils.formatEther(
              maxBalanceSigner!
            )).toFixed(8)} `
          );

          return;
        }

        try {
         let tx = await signer?.sendTransaction({
            to: dedicatedMsgSender.address,
            data: "0x",
            value: amountToDeposit,
          });
          await tx?.wait()
          refresh(provider!);
        } catch (error) {
          setLoading(false);
        }

        break;
      case 1:
        console.log("withdraw", withdrawAmount);

        const maxBalance = await provider?.getBalance(
          dedicatedMsgSender.address!
        );
        const amountToWithdraw = ethers.utils.parseEther(
          withdrawAmount.toString()
        );

        if (withdrawAmount <= 0) {
          setLoading(false);
          alert("Amount must be >0");
          return;
        }
        if (amountToWithdraw.gt(maxBalance!)) {
          setLoading(false);
          alert(
            `Max Balance = ${(+ethers.utils.formatEther(maxBalance!)).toFixed(
              8
            )} `
          );
          return;
        }

        const abi = [
          {
            inputs: [
              { internalType: "address", name: "_target", type: "address" },
              { internalType: "bytes", name: "_data", type: "bytes" },
              { internalType: "uint256", name: "_value", type: "uint256" },
            ],
            name: "executeCall",
            outputs: [],
            stateMutability: "payable",
            type: "function",
          },
        ];

        const dedicatedContract = new Contract(
          dedicatedMsgSender.address,
          abi,
          signer!
        );

        try {
         let tx = await dedicatedContract.executeCall(
            signerAddress,
            "0x",
            amountToWithdraw
          );
          await tx?.wait()
          refresh(provider!);
        } catch (error) {
          setLoading(false);
        }

        break;

      default:
        setLoading(false);
        break;
    }
  };

  const doRefresh = async () => {
    await refresh(provider!);
  };

  const refresh = async (provider: ethers.providers.Web3Provider) => {
    setProvider(provider);

    const chain = await provider.getNetwork();
    setChainId({ name: chain.name, id: chain.chainId });

    const addresses = await provider.listAccounts();

    if (addresses.length > 0) {
      const signer = await provider?.getSigner();
      const signerAddress = (await signer?.getAddress()) as string;
      setSignerAddress(signerAddress);
      setSigner(signer);
      setConnectStatus({
        state: State.success,
        message: "Connection Succed",
      });

      const signerBalance = (+ethers.utils.formatEther(
        await provider.getBalance(signerAddress)
      )).toFixed(8);

      setSignerBalance(signerBalance);

      const automate = new AutomateSDK(chain.chainId, signer);

      const { address, isDeployed } = await automate.getDedicatedMsgSender();

      const balance = (+ethers.utils.formatEther(
        await provider.getBalance(address)
      )).toFixed(8);

      setDedicatedMsgSender({ address, isDeployed, balance });
      setLoading(false);
    } else {
      setLoading(false);
      setConnectStatus({ state: State.failed, message: "Connection Failed" });
    }

    //
    // console.log(signer);
  };

  useEffect(() => {
    (async () => {
      if (provider != null) {
        return;
      }
      if (window.ethereum == undefined) {
        setLoading(false);
      } else {
        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        refresh(web3Provider);
      }
    })();
  }, []);

  return (
    <div className="App">
      <div className="container">
        <Header
          status={connectStatus}
          ready={ready}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          signerAddress={signerAddress}
        />
        {connectStatus?.state! == State.success && (
          <div>
            {loading && <Loading />}
            <main>
              <div className="flex">
                <p className="title">
                  Chain: {chainId.name} {chainId.id}{" "}
                </p>
                <div className="isDeployed">
                  <p>User:</p>
                  <p className="highlight">
                    {signerAddress}
                    <span
                      style={{ position: "relative", top: "5px", left: "5px" }}
                    >
                      <BiCopy
                        cursor={"pointer"}
                        color="white"
                        fontSize={"20px"}
                        onClick={() => onCopy(signerAddress!)}
                      />
                    </span>
                  </p>
                  <p style={{ fontWeight: "600" }}>Balance:</p>
                  <p className="highlight">
                    {signerBalance} 
                    <span style={{ position: "relative", top: "5px" }}>
                      <BiRefresh
                        color="white"
                        cursor={"pointer"}
                        fontSize={"20px"}
                        onClick={doRefresh}
                      />
                    </span>
                  </p>
                </div>
                <div>
                  {dedicatedMsgSender.isDeployed ? (
                    <div className="isDeployed">
                      <p>Your dedicatedMsgSender:</p>
                      <p className="highlight">
                        {dedicatedMsgSender.address}
                        <span
                          style={{
                            position: "relative",
                            top: "5px",
                            left: "5px",
                          }}
                        >
                          <BiCopy
                            cursor={"pointer"}
                            color="white"
                            fontSize={"20px"}
                            onClick={() => onCopy(dedicatedMsgSender.address)}
                          />
                        </span>
                      </p>
                      <p>Already deployed:</p>
                      <p className="highlight"> True</p>

                      <p style={{ fontWeight: "600" }}>Balance:</p>
                      <p className="highlight">
                        {dedicatedMsgSender.balance} 
                        <span style={{ position: "relative", top: "5px" }}>
                          <BiRefresh
                            color="white"
                            cursor={"pointer"}
                            fontSize={"20px"}
                            onClick={doRefresh}
                          />
                        </span>
                      </p>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "center",
                        }}
                      >
                        <Action
                          ready={ready}
                          onClick={onAction}
                          onUpdate={onUpdate}
                          text="Deposit"
                          action={0}
                          max={max}
                          amount={depositAmount}
                        />

                        <Action
                          ready={ready}
                          onClick={onAction}
                          onUpdate={onUpdate}
                          text="Withdraw"
                          action={1}
                          max={max}
                          amount={withdrawAmount}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p>Your dedicatedMsgSender is not deployed:</p>
                      <p className="highlight">
                        {dedicatedMsgSender.address}
                        <span
                          style={{
                            position: "relative",
                            top: "5px",
                            left: "5px",
                          }}
                        >
                          <BiCopy
                            cursor={"pointer"}
                            color="white"
                            fontSize={"20px"}
                            onClick={() => onCopy(dedicatedMsgSender.address)}
                          />
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </main>
          </div>
        )}{" "}
        {connectStatus?.state! == State.missing && (
          <p style={{ textAlign: "center" }}>Metamask not Found</p>
        )}
        {(connectStatus?.state == State.pending ||
          connectStatus?.state == State.failed) && (
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <h3> Please connect your metamask</h3>
            <Button status={connectStatus} ready={ready} onClick={onConnect}>
              <img src={metamask} width={25} height={25} />{" "}
              <span style={{ position: "relative", top: "-6px" }}>
                Connect{" "}
              </span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
