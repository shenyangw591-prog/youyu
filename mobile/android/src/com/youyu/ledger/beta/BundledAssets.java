package com.youyu.ledger.beta;

import java.io.Closeable;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** Reads the installed APK itself, independent of WebView's URL or AssetManager handling. */
public final class BundledAssets implements Closeable {
    private final ZipFile apk;

    public BundledAssets(String apkPath) throws IOException { apk = new ZipFile(apkPath); }

    public InputStream open(String requestPath) throws IOException {
        String path = requestPath;
        if (path == null || path.equals("/")) path = "/index.html";
        if (!path.startsWith("/") || path.contains("\\") || path.indexOf('\0') >= 0) throw new IOException("Invalid asset path");
        for (String segment : path.split("/")) {
            if (segment.equals("..") || segment.equals(".")) throw new IOException("Invalid asset path");
        }
        ZipEntry entry = apk.getEntry("assets/web" + path);
        if (entry == null || entry.isDirectory()) throw new IOException("Missing bundled asset: " + path);
        return apk.getInputStream(entry);
    }

    public String readHtml() throws IOException {
        try (InputStream input = open("/index.html"); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    @Override public void close() throws IOException { apk.close(); }
}
