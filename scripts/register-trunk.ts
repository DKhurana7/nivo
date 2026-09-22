/** Explicit operator-only action; never run automatically or from a browser. */
import { clients } from '../server/voice';
const address = process.env.SIP_ADDRESS,
  number = process.env.SIP_FROM_NUMBER;
// Values are the SDK's SIPTransport enum; choose the transport supported by the carrier.
const transports = { auto: 0, udp: 1, tcp: 2, tls: 3 } as const;
const transport = process.env.SIP_TRANSPORT || 'auto';
if (!(transport in transports)) throw new Error('SIP_TRANSPORT must be auto, udp, tcp or tls.');
if (!address || !number)
  throw new Error(
    'Set SIP_ADDRESS, SIP_FROM_NUMBER and optional SIP_USERNAME/SIP_PASSWORD in the operator environment.',
  );
const trunk = await clients().sip.createSipOutboundTrunk(
  'Nivo vendor quotations',
  address,
  [number],
  {
    transport: transports[transport as keyof typeof transports],
    authUsername: process.env.SIP_USERNAME,
    authPassword: process.env.SIP_PASSWORD,
  },
);
console.log(
  `Outbound trunk registered. Set LIVEKIT_SIP_TRUNK_ID=${trunk.sipTrunkId}. Calls remain disabled until ENABLE_OUTBOUND_CALLS=true.`,
);
