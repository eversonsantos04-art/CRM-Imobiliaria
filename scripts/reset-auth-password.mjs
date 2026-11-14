import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

function askHidden(label) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Abra um terminal interativo do Windows para inserir a chave e a senha com segurança.");
  }

  return new Promise((resolve, reject) => {
    let value = "";
    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();

    function finish(error) {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }

    function onData(chunk) {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") return finish(new Error("Operação cancelada."));
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          stdout.write("\b \b");
        } else {
          value += char;
          stdout.write("*");
        }
      }
    }

    stdin.on("data", onData);
  });
}

async function main() {
  const terminal = createInterface({ input: stdin, output: stdout });
  const projectUrl = (await terminal.question("URL do projeto Supabase: ")).trim();
  const userId = (await terminal.question("UUID do usuário (Authentication > Users): ")).trim();
  terminal.close();

  const secretKey = await askHidden("Chave secret do projeto (entrada oculta): ");
  const password = await askHidden("Nova senha (entrada oculta): ");

  if (!/^https:\/\//.test(projectUrl)) throw new Error("A URL deve começar com https://.");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("O UUID do usuário não parece válido.");
  if (!secretKey.startsWith("sb_secret_") && !secretKey.startsWith("eyJ")) {
    throw new Error("Use a chave secret atual (sb_secret_...) ou a service_role legada.");
  }
  if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");

  const supabase = createClient(projectUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(`Supabase não atualizou a senha: ${error.message}`);

  console.log("Senha atualizada. Entre no CRM com o e-mail da conta e a nova senha.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

