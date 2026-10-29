package com.youyu.ledger.beta;

import java.io.IOException;
import java.io.InputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** Exercises the production native reader against the final signed APK, not staging files. */
public final class BundledAssetsSmokeTest {
    public static void main(String[] args) throws Exception {
        int count = 0;
        try (BundledAssets assets = new BundledAssets(args[0]); ZipFile apk = new ZipFile(args[0])) {
            if (apk.stream().anyMatch(entry -> entry.getName().contains("\\"))) throw new AssertionError("APK contains Windows paths that Android cannot resolve");
            String html = assets.readHtml();
            if (!html.contains("id=\"root\"") || !html.contains("Content-Security-Policy")) throw new AssertionError("Invalid startup HTML");
            Matcher refs = Pattern.compile("(?:src|href)=\"(/[^\"]+)\"").matcher(html);
            int scripts = 0, styles = 0;
            while (refs.find()) {
                String path = refs.group(1);
                try (InputStream stream = assets.open(path)) {
                    if (stream.read() == -1) throw new AssertionError("Empty startup dependency: " + path);
                }
                if (path.endsWith(".js")) scripts++;
                if (path.endsWith(".css")) styles++;
            }
            if (scripts == 0 || styles == 0) throw new AssertionError("Missing startup script or styles");
            java.util.Enumeration<? extends ZipEntry> entries = apk.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                if (entry.isDirectory() || !entry.getName().startsWith("assets/web/")) continue;
                try (InputStream stream = assets.open(entry.getName().substring("assets/web".length()))) {
                    long bytes = 0;
                    byte[] buffer = new byte[8192];
                    int n;
                    while ((n = stream.read(buffer)) != -1) bytes += n;
                    if (bytes != entry.getSize()) throw new AssertionError("Truncated asset: " + entry.getName());
                }
                count++;
            }
            for (String invalid : new String[]{"/../AndroidManifest.xml", "/assets/../../classes.dex", "index.html", "/assets\\index.html", "/missing.js"}) {
                try (InputStream ignored = assets.open(invalid)) { throw new AssertionError("Accepted invalid path: " + invalid); }
                catch (IOException expected) {}
            }
            if (apk.getEntry("classes.dex") == null) throw new AssertionError("Missing native code");
        }
        System.out.println("Signed APK startup HTML, script, styles and " + count + " bundled assets passed native reader checks.");
    }
}
