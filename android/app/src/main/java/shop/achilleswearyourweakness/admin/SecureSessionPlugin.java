package shop.achilleswearyourweakness.admin;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Only encrypted session values leave memory; the AES key never leaves AndroidKeyStore. */
@CapacitorPlugin(name = "SecureSession")
public class SecureSessionPlugin extends Plugin {
    private static final String ALIAS = "achilles.session.v1";
    private static final String FILE = "achilles_secure_session";

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
        return generator.generateKey();
    }

    private String name(PluginCall call) {
        String name = call.getString("key");
        if (!"auth_token".equals(name) && !"auth_user".equals(name)) {
            throw new IllegalArgumentException("Unsupported session key");
        }
        return name;
    }

    @PluginMethod
    public synchronized void get(PluginCall call) {
        try {
            String name = name(call);
            String encoded = getContext().getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(name, null);
            JSObject result = new JSObject();
            if (encoded == null) {
                result.put("value", JSObject.NULL);
            } else {
                String[] parts = encoded.split(":", -1);
                if (parts.length != 2) throw new IllegalArgumentException("Invalid encrypted session");
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
                cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
                result.put("value", new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8));
            }
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Secure session could not be read", error);
        }
    }

    @PluginMethod
    public synchronized void set(PluginCall call) {
        try {
            String name = name(call);
            String value = call.getString("value");
            if (value == null) throw new IllegalArgumentException("Missing session value");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
            String encoded = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":"
                    + Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            if (!getContext().getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(name, encoded).commit()) {
                throw new IllegalStateException("Session write failed");
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("Secure session could not be saved", error);
        }
    }

    @PluginMethod
    public synchronized void remove(PluginCall call) {
        try {
            if (!getContext().getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().remove(name(call)).commit()) {
                throw new IllegalStateException("Session removal failed");
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("Secure session could not be removed", error);
        }
    }
}