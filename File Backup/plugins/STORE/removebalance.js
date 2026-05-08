import mess from "../../strings.js";
import { getGroupMetadata } from "../../lib/cache.js";
import { saveUsers, updateUser } from "../../lib/users.js";
import {
  formatBalance,
  getTargetAndAmountFromMessage,
  getUserMentionJid,
  getUserMentionText,
  parsePositiveAmount,
  resolveBalanceUser,
} from "../../lib/storeBalance.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, prefix, command } = messageInfo;

  if (!isGroup) {
    return await sock.sendMessage(
      remoteJid,
      { text: mess.general.isGroup },
      { quoted: message }
    );
  }

  const groupMetadata = await getGroupMetadata(sock, remoteJid);
  const participants = groupMetadata?.participants || [];
  const isAdmin = participants.some(
    (participant) =>
      (participant.phoneNumber === sender || participant.id === sender) &&
      participant.admin
  );

  if (!isAdmin) {
    return await sock.sendMessage(
      remoteJid,
      { text: mess.general.isAdmin },
      { quoted: message }
    );
  }

  const { rawTarget, rawAmount } = getTargetAndAmountFromMessage(messageInfo);
  const amount = parsePositiveAmount(rawAmount);

  if (!rawTarget || !amount) {
    return await sock.sendMessage(
      remoteJid,
      {
        text:
          `Format: *${prefix + command} @tag 10000*\n\n` +
          `Contoh:\n` +
          `- *${prefix + command} @tag 10000*\n` +
          `- reply user lalu kirim *${prefix + command} 10000*`,
      },
      { quoted: message }
    );
  }

  const resolved = await resolveBalanceUser(sock, rawTarget, messageInfo.senderType);
  if (!resolved.dataUsers) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: "WARNING: user belum ditemukan.",
      },
      { quoted: message }
    );
  }

  const [, userData] = resolved.dataUsers;
  const currentBalance = userData.money || 0;

  if (currentBalance < amount) {
    return await sock.sendMessage(
      remoteJid,
      {
        text:
          `WARNING: balance user tidak cukup untuk dikurangi.\n\n` +
          `Balance saat ini : *Rp ${formatBalance(currentBalance)}*`,
      },
      { quoted: message }
    );
  }

  const targetJid = getUserMentionJid(userData, resolved.resolvedJid);
  const targetText = getUserMentionText(userData, resolved.resolvedJid);
  const newBalance = currentBalance - amount;

  await updateUser(targetJid, { money: newBalance });
  await saveUsers();

  await sock.sendMessage(
    remoteJid,
    {
      text:
        `*BALANCE BERHASIL DIKURANGI*\n\n` +
        `User : ${targetText}\n` +
        `Nominal : *Rp ${formatBalance(amount)}*\n` +
        `Balance sekarang : *Rp ${formatBalance(newBalance)}*`,
      contextInfo: {
        mentionedJid: targetJid ? [targetJid] : [],
      },
    },
    { quoted: message }
  );
}

export default {
  handle,
  Commands: [
    "removebalance",
    "removebal",
    "minbalance",
    "minbal",
    "kurangsaldo",
    "removesaldo",
  ],
  OnlyPremium: false,
  OnlyOwner: false,
};
