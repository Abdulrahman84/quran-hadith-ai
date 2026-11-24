package ai.sanad.app;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Draw behind the system bars on every Android version; the web UI pads
        // itself with the safe-area insets (SystemBars insetsHandling "native").
        // Must run after super.onCreate, which swaps the launch theme for the
        // no-action-bar app theme before the window decor is created.
        EdgeToEdge.enable(this);
    }
}
