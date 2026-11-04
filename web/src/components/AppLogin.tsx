import { live as L } from '../i18n/live';
import { useSession } from '../state/session';

/** O login de teste. No navegador é um botão (vai para a página de login da API); no app desktop são os nomes de teste. */
export function DevSignIn() {
  const { devLogin, devNames, signInDev } = useSession();
  if (!devLogin) return null;
  if (devNames.length === 0) {
    return (
      <button type="button" className="btn btn-s btn-sm acct-dev" onClick={() => signInDev()}>
        {L.devSignIn}
      </button>
    );
  }
  return (
    <span className="acct-dev-group" role="group" aria-label={L.devNamesLabel}>
      <small>{L.devSignIn}</small>
      {devNames.map((name) => (
        <button key={name} type="button" className="btn btn-s btn-sm acct-dev" onClick={() => signInDev(name)}>
          {name}
        </button>
      ))}
    </span>
  );
}

/** No app desktop, enquanto o login da Steam está aberto no navegador. */
export function SignInPending() {
  const { cancelSignIn } = useSession();
  return (
    <div className="login-pending" role="status">
      <b>{L.appLoginPending}</b>
      <small>{L.appLoginPendingHint}</small>
      <button type="button" className="btn btn-s btn-sm" onClick={cancelSignIn}>
        {L.appLoginCancel}
      </button>
    </div>
  );
}
