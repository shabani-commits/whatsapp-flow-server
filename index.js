const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// 🔑 KEYS (YOURS)
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAm7Sv3bNH5lg+GCmdJBNq
3deYTcXbNIX/WJeMTqnfwDs02/PnYLaHkTsDAHTWNmeXdsXZ5vJh8M77gLQBLwsB
B61VpXy4ItElpdFIqec2hYD9O81mU6JdIjMhssReJ8whN80HmExnGCsYzVaNG39C
oYaStVAGg20uZzIc/+A6Zu9Zdm8XO/dmXpVlMEAQfqQFliAUrR++/8bgzEifOlRN
Ms9UuclzcnAcftiFpBQ9MOOjtZ96RuLdXgilGOpJDrPmaEk276c9CzBTkFVAbS+k
l09p0Q01Yunw96HTJfER6hrHuIM21AFTn5uoIcGybufOdohQCTUZuBkj8q9dh8Xg
hwIDAQAB
-----END PUBLIC KEY-----`;

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCbtK/ds0fmWD4Y
KZ0kE2rd15hNxds0hf9Yl4xOqd/AOzTb8+dgtoeROwMAdNY2Z5d2xdnm8mHwzvuA
tAEvCwEHrVWlfLgi0SWl0Uip5zaFgP07zWZTol0iMyGyxF4nzCE3zQeYTGcYKxjN
Vo0bf0KhhpK1UAaDbS5nMhz/4Dpm71l2bxc792ZelWUwQBB+pAWWIBStH77/xuDM
SJ86VE0yz1S5yXNycBx+2IWkFD0w46O1n3pG4t1eCKUY6kkOs+ZoSTbvpz0LMFOQ
VUBtL6SXT2nRDTVi6fD3odMl8RHqGse4gzbUAVOfm6ghwbJu5852iFAJNRm4GSPy
r12HxeCHAgMBAAECggEACni24SKXActKdcaKrmvt4niG4igdy2T9nMAoa/vps9xn
fClllLAB4wcEdynkZClIWvEIbAs+Aftxl6DDeZ30VkdWfLgsDA9jyEiQafjGRmk7
3qM8MAC54bxtlj+1k1ibnUyZJ6lvv4TaeKjK+Z/v47wQrsfwgDM+DSumHqE+XEC+
nzpsrV1yk2bbIpY3ds9JipZ00po4iNM1+e0gbnewKp+TpgvwW4zZAoCs1522+SVu
bSS1wjO4jGrfbDqyYEgH4enK+hrK6QcbrdLyZby9G9yKRopD3ZIWxRsTbqEzkp8E
Adp2ySEC7Yr1Y2PHZuf8PPmwFKUDE4YUveQvErCNjQKBgQDZ0BGEgDUcGmG6+2XF
klt+gf4m88QzmDyLgBmEvJ3eb6QImN2/URwKktQoyKKTqLd6d0iGJCsurSNYeHUb
kGXKOjr1mSuC9dD7otmhO19Rj0pQm70gJL5OTGMZYLWWtC0HJekDfjh3dS+YfcgN
xKMIHlnQAUj1H92BS14kgVCPGwKBgQC3AR4BzMyLj2xLINKfbpPXNg2TZuCiJCZp
yvkJYVUMjieJBXFFR59BNcV/QR1Zj1ntGCvcpW8fVab06nLC2sdC5TWruPJygcD/
adS1QV8+/Kf0aHs+dk9lCCDecBM/R409fMPPDLpsUvhzhdIK95zKeHrgMmAmidG8
J06ccPmPBQKBgCvOokdQ9d2SHMfbmitzdT1rba9t5a8u1jaEbB17RhEfyREFlcvN
x2MFBvCw8anbDBPwe8Cm85xurCY2C++gSiizL3qH9O1g/UgvB7Ba3Z/svtiZih81
5KSgzmmjPsJxuICwij3um/LCufDkk2DZhKS0XgHs0DykzQsdGnEjJQ2zAoGBAInU
/ZS9exFh5F5xSjFqR09AFtl+EpIMSCJGDWtTM4tRRdWdk8JqPzgOF8HQeRqLLV+1
ZNO6hgdDq4urSOQZgxqPJ+0+TtyPfZzhSKN7qRD3mkgqqShSU1n01UyzfMucSHSX
E6NOItqTYy0fDSPVevHD7EgPqPtdsenUcRDCxjNBAoGBALbQUDNKfgNVEwOeTezL
h4G2ig32igAXSmiXtl7vfzYr/qGbszLhdhyOkzXF2FbHIB865u4Y1A2a1xG0KTvT
Ju/QCh/JRrCYKX1/YQGJFr6sEwKm+nq7nwsWCitclJ/Up1t2VKwAIwOHW77n+QCg
v6XQbYOzdDovs36EZz4bsU/B
-----END PRIVATE KEY-----`;

// ✅ PUBLIC KEY ENDPOINT
app.get("/.well-known/public-key", (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.send(PUBLIC_KEY.trim());
});

// ✅ FLOW ENDPOINT
app.post("/flow", (req, res) => {
  try {
    const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body;

    // 🔓 RSA decrypt AES key
    const aesKey = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );

    console.log("🔑 AES KEY LENGTH:", aesKey.length);

    const algorithm = aesKey.length === 32 ? "aes-256-cbc" : "aes-128-cbc";

    // 🔥 FIX IV
    const iv = Buffer.from(initial_vector, "base64").subarray(0, 16);

    // 🔓 DECRYPT REQUEST
    const decipher = crypto.createDecipheriv(algorithm, aesKey, iv);
    decipher.setAutoPadding(false);

    let decrypted = decipher.update(Buffer.from(encrypted_flow_data, "base64"));
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    // remove padding junk
    decrypted = decrypted.toString().replace(/\0+$/, "");

    const request = JSON.parse(decrypted);

    // ⚙️ RESPONSE
    const response =
      request?.action === "ping"
        ? { version: "1.0", data: { status: "active" } }
        : { version: "1.0", screen: "SUCCESS", data: {} };

    // 🔐 ENCRYPT RESPONSE
    const cipher = crypto.createCipheriv(algorithm, aesKey, iv);
    cipher.setAutoPadding(false);

    let encrypted = cipher.update(JSON.stringify(response), "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const base64 = encrypted.toString("base64");

    // ✅ RAW BASE64 RESPONSE (CRITICAL)
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(base64);

  } catch (err) {
    console.error("🔥 ERROR:", err);
    return res.status(200).send("");
  }
});

// 🚀 START
app.listen(process.env.PORT || 10000, () => {
  console.log("🚀 Server running");
});
