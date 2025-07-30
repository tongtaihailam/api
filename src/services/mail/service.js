const mariadb = require("@common/mariadb");
const responses = require("@common/responses");
const MailAttachmentTypes = require("@constants/MailAttachmentTypes");
const MailStatuses = require("@constants/MailStatuses");
const MailAttachment = require("@models/MailAttachment");
const MailStatus = require("@models/MailStatus");
const Mail = require("@models/Mail");
const base = require("@mail-service/base");
const payServiceBase = require("@pay-service/base");
const decorationServiceBase = require("@decoration-service/base");
const userServiceBase = require("@user-service/base");

async function getMailList(userId) {
    const mails = await base.getMailboxByUserId(userId);
    return responses.success(mails);
}

async function setMailStatus(userId, mailIds, targetStatus) {
    if (targetStatus < MailStatuses.READ || targetStatus > MailStatuses.DELETE) {
        return responses.invalidMailStatus();
    }

    const mails = await base.getMailboxByUserId(userId);
    if (mails.length == 0) {
        return responses.success();
    }

    const statuses = [];
    for (var i = 0; i < mails.length; i++) {
        if (!mailIds.includes(mails[i].id)) {
            continue;
        }

        // Can't set status if mail isn't read
        if (mails[i].status == MailStatuses.UNREAD && targetStatus == MailStatuses.DELETE) {
            continue;
        }

        // Can't set status if attachments aren't claimed 
        if (mails[i].status == MailStatuses.UNREAD && mails[i].getAttachments().length > 0 && targetStatus > MailStatuses.UNREAD) {
            continue;
        }

        statuses.push({ 
            id: mails[i].id, 
            status: targetStatus 
        });
    }

    await mariadb.addOrUpdateJsonArray("mailbox_record", userId, statuses);
    return responses.success();
}

async function receiveMailAttachment(userId, mailId) {
    const mails = await base.getMailboxByUserId(userId, true);

    let isMailValid = false;
    let targetMail = null;

    for (let i = 0; i < mails.length; i++) {
        if (mails[i].id == mailId) {
            isMailValid = true;
            targetMail = Mail.fromJson(mails[i]);
        }
    }

    
    if (!isMailValid) {
        return responses.mailNotFound();
    }

    const mailAttachments = targetMail.getAttachments();
    if (!mailAttachments || mailAttachments.length == 0) {
        return responses.mailHasNoAttachments();
    }

    for (let i = 0; i < mailAttachments.length; i++) {
        const attachment = MailAttachment.fromJson(mailAttachments[i]);
        switch (attachment.getType()) {
            case MailAttachmentTypes.CURRENCY:
                await payServiceBase.addCurrency(userId, attachment.getItemId(), attachment.getQuantity());
                break;
            case MailAttachmentTypes.DRESS:
                await decorationServiceBase.addDresses(userId, [attachment.getItemId()]);
                break;
            case MailAttachmentTypes.VIP:
                await userServiceBase.addVip(userId, attachment.getVipLevel(), attachment.getVipDuration());
                break;
        }
    }

    const mailStatus = new MailStatus();
    mailStatus.setId(targetMail.getId());
    mailStatus.setStatus(MailStatuses.READ);

    await mariadb.addOrUpdateJsonArray("mailbox_record", userId, [mailStatus]);
    return responses.success();
}

async function hasNewMail(userId) {
    const mails = base.getMailboxByUserId(userId);

    let hasNewMail = false;
    for (let i = 0; i < mails.length; i++) {
        if (mails[i].getStatus() == MailStatuses.UNREAD) {
            hasNewMail = true;
            break;
        }
    }

    return responses.success(hasNewMail);
}

module.exports = {
    getMailList: getMailList,
    setMailStatus: setMailStatus,
    receiveMailAttachment: receiveMailAttachment,
    hasNewMail: hasNewMail
}