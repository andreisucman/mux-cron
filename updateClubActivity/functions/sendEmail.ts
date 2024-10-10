import { sesClient } from "../init.js";
import { SendEmailCommand } from "@aws-sdk/client-ses";
import addErrorLog from "../helpers/addErrorLog.js";

type SendEmailProps = {
  to: string;
  from: string;
  subject: string;
  text: string;
};

const sendEmail = async ({
  to,
  from = process.env.SES_FROM_ADDRESS,
  subject,
  text,
}: SendEmailProps) => {
  const params = {
    Destination: { ToAddresses: [to] },
    Message: {
      Body: {
        Text: { Data: text },
      },
      Subject: { Data: subject },
    },
    Source: from,
  };

  try {
    const sendEmailCommand = new SendEmailCommand(params);
    await sesClient.send(sendEmailCommand);
  } catch (err) {
    addErrorLog({ functionName: "sendEmail", message: err.message });
    throw err;
  }
};

export default sendEmail;
