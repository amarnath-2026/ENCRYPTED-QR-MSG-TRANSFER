import qrcode
import cv2
from cryptography.fernet import Fernet
from pyzbar.pyzbar import decode

# --------------------------------------
# Step 1: Generate encryption key
# --------------------------------------
key = Fernet.generate_key()
cipher_suite = Fernet(key)
print("\n🔑 Encryption Key (keep this safe to decrypt):", key.decode())

# --------------------------------------
# Step 2: Encrypt user message
# --------------------------------------
message = input("\nEnter the message to encrypt: ")
encrypted_text = cipher_suite.encrypt(message.encode())
print("\n🔒 Encrypted Message:", encrypted_text.decode())

# --------------------------------------
# Step 3: Generate QR code with encrypted data
# --------------------------------------
qr = qrcode.QRCode(version=1, box_size=10, border=5)
qr.add_data(encrypted_text.decode())
qr.make(fit=True)

img = qr.make_image(fill="black", back_color="white")
qr_filename = "encrypted_qr.png"
img.save(qr_filename)
print(f"\n✅ QR Code generated and saved as '{qr_filename}'")

# --------------------------------------
# Step 4A: Scan QR Code from saved image
# --------------------------------------
print("\n📷 Scanning the QR code from saved image...")

qr_img = cv2.imread(qr_filename)
decoded_objects = decode(qr_img)

for obj in decoded_objects:
    encrypted_data = obj.data.decode("utf-8")
    print("📥 Encrypted data from QR:", encrypted_data)

    decrypted_message = cipher_suite.decrypt(encrypted_data.encode()).decode()
    print("✅ Decrypted Message:", decrypted_message)

# --------------------------------------
# Step 4B: (Optional) Live QR Scanner via Webcam
# --------------------------------------
choice = input("\nDo you want to scan using webcam? (y/n): ").lower()

if choice == "y":
    print("\n📸 Opening webcam... Press 'q' to quit.")
    cap = cv2.VideoCapture(0)

    while True:
        ret, frame = cap.read()
        decoded_objects = decode(frame)

        for obj in decoded_objects:
            encrypted_data = obj.data.decode("utf-8")
            print("\n📥 Encrypted data from QR (Webcam):", encrypted_data)

            decrypted_message = cipher_suite.decrypt(encrypted_data.encode()).decode()
            print("✅ Decrypted Message (Webcam):", decrypted_message)

            # Draw a rectangle around the QR code
            (x, y, w, h) = obj.rect
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

        cv2.imshow("QR Scanner", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()

print("\n🎉 Process completed: Encryption → QR generation → Scanning → Decryption")
