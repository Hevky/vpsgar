import mess from "../../strings.js";
import { getGroupMetadata } from "../../lib/cache.js";
import { findUser, isOwner } from "../../lib/users.js";
import {
  formatBalance,
  getTargetFromMessage,
  getUserMentionJid,
  getUserMentionText,
  resolveBalanceUser,
} from "../../lib/storeBalance.js";

async function isGroupAdmin(sock, remoteJid, sender, isGroup) {
  if (!isGroup) {
    return false;
  }

  const groupMetadata = await getGroupMetadata(sock, remoteJid);
  const participants = groupMetadata?.participants || [];

  return participants.some(
    (participant) =>
      (participant.phoneNumber === sender || participant.id === sender) &&
      participant.admin
  );
}

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, content, prefix, command } =
    messageInfo;

  let dataUsers = findUser(sender);
  let mentionJid = sender;

  const target = getTargetFromMessage(messageInfo);
  const targetIsOtherUser = Boolean(target && target !== sender);

  if (targetIsOtherUser) {
    const allowed =
      isOwner(sender) || (await isGroupAdmin(sock, remoteJid, sender, isGroup));

    if (!allowed) {
      return await sock.sendMessage(
        remoteJid,
        {
          text:
            `${mess.general.isAdmin}\n\n` +
            `Untuk cek balance user lain gunakan *${prefix + command} @tag* atau reply chat user.`,
        },
        { quoted: message }
      );
    }

    const resolved = await resolveBalanceUser(sock, target, messageInfo.senderType);
    dataUsers = resolved.dataUsers;
    mentionJid = resolved.resolvedJid || target;
  } else if (content?.trim() && !dataUsers) {
    const resolved = await resolveBalanceUser(sock, content.trim(), messageInfo.senderType);
    dataUsers = resolved.dataUsers;
    mentionJid = resolved.resolvedJid || content.trim();
  }

  if (!dataUsers) {
    return await sock.sendMessage(
      remoteJid,
      {
        text:
          "WARNING: user belum ditemukan. Pastikan user sudah pernah chat bot dulu.\n\n" +
          `Tips admin: *${prefix + command} @tag* atau reply chat user lalu kirim *${prefix + command}*`,
      },
      { quoted: message }
    );
  }

  const [, userData] = dataUsers;
  const finalMentionJid = getUserMentionJid(userData, mentionJid) || sender;
  const finalMentionText = getUserMentionText(userData, mentionJid);
  const balance = userData.money || 0;

  await sock.sendMessage(
    remoteJid,
    {
      text:
        `*INFO BALANCE*\n\n` +
        `User : ${finalMentionText}\n` +
        `Balance : *Rp ${formatBalance(balance)}*`,
      contextInfo: {
        mentionedJid: [finalMentionJid],
      },
    },
    { quoted: message }
  );
}

export default {
  handle,
  Commands: ["balance", "saldo", "ceksaldo", "cekbalance", "cekbal"],
  OnlyPremium: false,
  OnlyOwner: false,
};
